/**
 * popup.js — Agent controller
 * Orchestrates: user input → Claude (via secure proxy) → page actions → repeat
 */

const PROXY_URL = 'https://strengths-township-incurred-boating.trycloudflare.com';
const MODEL = 'claude-sonnet-4-6';
const MAX_TURNS = 10;

const messagesEl = document.getElementById('messages');
const inputEl    = document.getElementById('input');
const sendBtn    = document.getElementById('send');
const clearBtn   = document.getElementById('clear-btn');
const pageUrlEl  = document.getElementById('page-url');

let history = [];
let running = false;

// Show current page URL in header
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    try {
      const u = new URL(tabs[0].url);
      pageUrlEl.textContent = u.hostname + (u.pathname !== '/' ? u.pathname : '');
      pageUrlEl.title = tabs[0].url;
    } catch { pageUrlEl.textContent = tabs[0].url?.slice(0, 40) || ''; }
  }
});

const TOOLS = [
  {
    name: 'snapshot',
    description: 'Get the current page state: URL, title, headings, visible text, and all interactive elements (buttons, links, inputs) with CSS selectors and ARIA labels.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'click',
    description: 'Click an element by CSS selector.',
    input_schema: {
      type: 'object',
      properties: { selector: { type: 'string' } },
      required: ['selector']
    }
  },
  {
    name: 'fill',
    description: 'Fill a form field (input or textarea) with a value. Works on React and vanilla apps.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        value: { type: 'string' }
      },
      required: ['selector', 'value']
    }
  },
  {
    name: 'navigate',
    description: 'Navigate to a URL.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page up or down to reveal more content.',
    input_schema: {
      type: 'object',
      properties: { direction: { type: 'string', enum: ['up', 'down'] } },
      required: ['direction']
    }
  },
  {
    name: 'done',
    description: 'Signal that the task is complete.',
    input_schema: {
      type: 'object',
      properties: { summary: { type: 'string', description: 'One sentence summary of what was accomplished.' } },
      required: ['summary']
    }
  }
];

const SYSTEM = `You are a web automation agent inside a Webfuse-proxied browser session. You have direct, structured access to the live page — real auth, real cookies, real state — no screenshots, no guessing.

Tools: snapshot, click, fill, navigate, scroll, done.

Rules:
1. Start every task with snapshot()
2. Prefer stable selectors: id > data-testid > aria-label > name > text-hint > positional
3. After each action, snapshot again to verify the result
4. After navigate(), snapshot() will include readyState — if it shows 'loading', snapshot() again before acting
5. On failure, try an alternative selector or approach before giving up
6. Be efficient — don't over-explain, just act
7. Call done() with a one-sentence summary when the task is complete`;

const SUGGESTIONS = [
  '🔍 Search for "AI agents" using the search bar',
  '📄 Summarise the main points on this page',
  '🔗 Find and click the first link in the article',
  '📰 What are the section headings on this page?',
];

function showSuggestions() {
  const wrap = document.createElement('div');
  wrap.className = 'suggestions';
  SUGGESTIONS.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'suggestion';
    btn.textContent = s;
    btn.onclick = () => {
      wrap.remove();
      inputEl.value = s.replace(/^[^\w]+/, '');
      sendBtn.click();
    };
    wrap.appendChild(btn);
  });
  messagesEl.appendChild(wrap);
  msg('system', 'Powered by Webfuse + Claude · webfu.se/+hummerbot');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function msg(role, text) {
  const d = document.createElement('div');
  d.className = `msg ${role}`;
  d.textContent = text;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return d;
}

function action(name, input) {
  const args = Object.entries(input)
    .map(([k, v]) => `${k}="${String(v).slice(0, 35)}"`)
    .join(', ');
  const d = document.createElement('div');
  d.className = 'msg thinking';
  d.innerHTML = `<span class="action-pill">${name}(${args})</span>`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pageTool(type, payload = {}) {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return resolve({ error: 'No active tab' });
      chrome.tabs.sendMessage(tabs[0].id, { type, payload }, (res) => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
        else resolve(res?.result ?? res ?? { error: 'No response from content script' });
      });
    });
  });
}

async function callClaude(messages, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${PROXY_URL}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = (attempt + 1) * 1500;
        if (attempt < retries) { await sleep(wait); continue; }
      }
      if (!res.ok) throw new Error(`Proxy ${res.status}: ${(await res.text()).slice(0, 150)}`);
      return res.json();
    } catch (e) {
      if (attempt < retries && e.name !== 'SyntaxError') { await sleep((attempt + 1) * 1500); continue; }
      throw e;
    }
  }
}

async function run(goal) {
  running = true;
  sendBtn.disabled = true;
  inputEl.disabled = true;
  history = [{ role: 'user', content: goal }];
  msg('user', goal);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const thinking = msg('thinking', '⏳ thinking…');
    let claude;
    try { claude = await callClaude(history); }
    catch (e) { thinking.remove(); msg('error', `❌ ${e.message}`); break; }
    thinking.remove();

    claude.content.filter(b => b.type === 'text' && b.text.trim()).forEach(b => msg('agent', b.text.trim()));

    if (claude.stop_reason === 'end_turn') break;

    const uses = claude.content.filter(b => b.type === 'tool_use');
    if (!uses.length) break;

    history.push({ role: 'assistant', content: claude.content });
    const results = [];
    let done = false;

    for (const { id, name, input } of uses) {
      action(name, input);
      if (name === 'done') {
        msg('agent', `✅ ${input.summary}`);
        results.push({ type: 'tool_result', tool_use_id: id, content: 'Done.' });
        done = true; break;
      }
      let r;
      if      (name === 'snapshot')  r = await pageTool('SNAPSHOT');
      else if (name === 'click')     r = await pageTool('CLICK', input);
      else if (name === 'fill')      r = await pageTool('FILL', input);
      else if (name === 'navigate') {
        await pageTool('NAVIGATE', input);
        // Poll readyState, then return the final snapshot as the tool result
        // so Claude doesn't need a separate snapshot() call after navigation
        const deadline = Date.now() + 5000;
        let finalSnap = { ok: true, navigated: input.url };
        while (Date.now() < deadline) {
          await sleep(400);
          const check = await pageTool('SNAPSHOT');
          if (check?.readyState === 'complete' || check?.readyState === 'interactive') {
            finalSnap = check; break;
          }
        }
        r = finalSnap;
      }
      else if (name === 'scroll')    r = await pageTool('SCROLL', input);
      else                           r = { error: `Unknown tool: ${name}` };
      results.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(r).slice(0, 3000) });
    }

    history.push({ role: 'user', content: results });
    if (done) break;
  }

  running = false;
  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();
}

sendBtn.addEventListener('click', () => {
  const goal = inputEl.value.trim();
  if (!goal || running) return;
  inputEl.value = '';
  run(goal);
});

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});

clearBtn.addEventListener('click', () => {
  messagesEl.innerHTML = '';
  history = [];
  showSuggestions();
  // Refresh page URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      try {
        const u = new URL(tabs[0].url);
        pageUrlEl.textContent = u.hostname + (u.pathname !== '/' ? u.pathname : '');
      } catch { pageUrlEl.textContent = tabs[0].url?.slice(0, 40) || ''; }
    }
  });
});

// Init
showSuggestions();
