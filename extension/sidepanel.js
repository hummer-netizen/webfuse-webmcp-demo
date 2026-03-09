/**
 * sidepanel.js — Persistent agent chat UI
 * Communicates with background.js for API calls, and content.js for page tools.
 * Survives navigation because sidepanel is a separate extension context.
 */

const MODEL = 'claude-3-haiku-20240307';
const MAX_TURNS = 10;

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');

let running = false;

const TOOLS = [
  { name: 'snapshot', description: 'Get page state: URL, title, headings, visible text, interactive elements with CSS selectors.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'click', description: 'Click an element by CSS selector.', input_schema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'fill', description: 'Fill a form field with a value.', input_schema: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] } },
  { name: 'navigate', description: 'Navigate to a URL.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'scroll', description: 'Scroll the page up or down.', input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'] } },
  { name: 'done', description: 'Signal task complete.', input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } },
];

const SYSTEM = `You are a web automation agent inside a Webfuse-proxied browser session. You have direct, structured access to the live page — real auth, real cookies, real state.

Tools: snapshot, click, fill, navigate, scroll, done.

Rules:
1. Start every task with snapshot()
2. Prefer stable selectors: id > data-testid > aria-label > name > positional
3. After each action, snapshot again to verify the result
4. On failure, try an alternative selector or approach before giving up
5. Be efficient — don't over-explain, just act
6. Call done() with a one-sentence summary when the task is complete`;

// ── UI helpers ─────────────────────────────────────────────────────────────
function addMsg(role, text) {
  const d = document.createElement('div');
  d.className = `msg ${role}`;
  d.textContent = text;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return d;
}
function addAction(name, input) {
  const args = Object.entries(input).map(([k, v]) => `${k}="${String(v).slice(0, 30)}"`).join(', ');
  const d = document.createElement('div');
  d.className = 'msg thinking';
  d.innerHTML = `<span class="action-pill">${name}(${args})</span>`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function setActive(on) {
  document.body.classList.toggle('active', on);
  statusEl.textContent = on ? 'working…' : 'ready';
  statusEl.classList.toggle('thinking', on);
}

// ── Suggestions ────────────────────────────────────────────────────────────
const SUGGESTIONS = ['🔍 Search for "AI agents"', '📄 Summarise this page', '🔗 Click the first link', '📰 List the section headings'];
function showSuggestions() {
  const wrap = document.createElement('div');
  wrap.className = 'suggestions';
  SUGGESTIONS.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'suggestion';
    btn.textContent = s;
    btn.onclick = () => { wrap.remove(); inputEl.value = s.replace(/^[^\w]+/, ''); sendBtn.click(); };
    wrap.appendChild(btn);
  });
  messagesEl.appendChild(wrap);
  addMsg('system', 'Powered by Webfuse + Claude · webfuse.com');
}
showSuggestions();

// ── Talk to content script (page tools) via background relay ───────────────
let _toolPending = {};
let _toolReqId = 0;

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TOOL_RESULT' && _toolPending[message.reqId]) {
    const { resolve } = _toolPending[message.reqId];
    delete _toolPending[message.reqId];
    resolve(message.result);
  }
  // Stream events from background
  if (message?.type === 'CLAUDE_STREAM' || message?.type === 'CLAUDE_STREAM_END' || message?.type === 'CLAUDE_RESPONSE') {
    const reqId = message.reqId;
    const pending = _claudePending[reqId];
    if (!pending) return;

    if (message.type === 'CLAUDE_RESPONSE') {
      delete _claudePending[reqId];
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.data);
    } else if (message.type === 'CLAUDE_STREAM') {
      const evt = message.event;
      if (evt.type === 'content_block_delta') {
        if (evt.delta?.type === 'text_delta' && evt.delta.text) {
          pending.textSoFar += evt.delta.text;
          if (pending.onText) pending.onText(pending.textSoFar);
        } else if (evt.delta?.type === 'input_json_delta' && evt.delta.partial_json) {
          pending.jsonSoFar += evt.delta.partial_json;
        }
      } else if (evt.type === 'content_block_start') {
        if (evt.content_block?.type === 'tool_use') {
          pending.currentTool = { id: evt.content_block.id, name: evt.content_block.name };
          pending.jsonSoFar = '';
        } else if (evt.content_block?.type === 'text') {
          pending.textSoFar = '';
        }
      } else if (evt.type === 'content_block_stop') {
        if (pending.currentTool) {
          let input = {};
          try { input = JSON.parse(pending.jsonSoFar || '{}'); } catch (_) {}
          pending.toolUses.push({ type: 'tool_use', id: pending.currentTool.id, name: pending.currentTool.name, input });
          pending.currentTool = null; pending.jsonSoFar = '';
        }
        if (pending.textSoFar) { pending.textBlocks.push(pending.textSoFar); pending.textSoFar = ''; }
      } else if (evt.type === 'message_delta') {
        pending.stopReason = evt.delta?.stop_reason;
      }
    } else if (message.type === 'CLAUDE_STREAM_END') {
      delete _claudePending[reqId];
      const content = [];
      for (const t of pending.textBlocks) content.push({ type: 'text', text: t });
      for (const tu of pending.toolUses) content.push(tu);
      pending.resolve({ content, stop_reason: pending.stopReason || 'end_turn' });
    }
  }
});

function execToolOnPage(name, input) {
  return new Promise((resolve) => {
    const reqId = ++_toolReqId;
    _toolPending[reqId] = { resolve };
    setTimeout(() => { if (_toolPending[reqId]) { delete _toolPending[reqId]; resolve({ error: 'Content script timeout' }); } }, 10000);
    browser.runtime.sendMessage({ type: 'TOOL_EXEC', reqId, name, input });
  });
}

// ── Claude API (via background) ────────────────────────────────────────────
let _claudePending = {};
let _claudeReqId = 0;

function callClaude(messages, onText) {
  return new Promise((resolve, reject) => {
    const reqId = 'sp_' + (++_claudeReqId);
    _claudePending[reqId] = {
      resolve, reject, onText,
      textSoFar: '', jsonSoFar: '', textBlocks: [], toolUses: [],
      currentTool: null, stopReason: null,
    };
    setTimeout(() => { if (_claudePending[reqId]) { delete _claudePending[reqId]; reject(new Error('Timeout (30s)')); } }, 30000);
    browser.runtime.sendMessage({
      type: 'CLAUDE_API', reqId,
      payload: { model: MODEL, max_tokens: 512, system: SYSTEM, tools: TOOLS, messages }
    });
  });
}

// ── Agent loop ─────────────────────────────────────────────────────────────
async function run(goal) {
  running = true;
  sendBtn.disabled = true;
  inputEl.disabled = true;
  setActive(true);
  const history = [{ role: 'user', content: goal }];
  addMsg('user', goal);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const thinking = addMsg('thinking', '✨ thinking…');
    let streamMsg = null;

    let claude;
    try {
      claude = await callClaude(history, (textSoFar) => {
        if (!streamMsg) { thinking.remove(); streamMsg = addMsg('agent', ''); }
        streamMsg.textContent = textSoFar;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    } catch (e) { thinking.remove(); addMsg('error', `❌ ${e.message}`); break; }

    if (!streamMsg) thinking.remove();
    if (!streamMsg) claude.content.filter(b => b.type === 'text' && b.text.trim()).forEach(b => addMsg('agent', b.text.trim()));
    if (claude.stop_reason === 'end_turn') break;

    const uses = claude.content.filter(b => b.type === 'tool_use');
    if (!uses.length) break;

    history.push({ role: 'assistant', content: claude.content });
    const results = [];
    let done = false;

    for (const { id, name, input } of uses) {
      addAction(name, input);
      if (name === 'done') { addMsg('agent', `✅ ${input.summary}`); results.push({ type: 'tool_result', tool_use_id: id, content: 'Done.' }); done = true; break; }
      const r = await execToolOnPage(name, input);
      if (name === 'navigate') {
        results.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(r).slice(0, 2000) });
        // Wait for page to load after navigation
        addMsg('system', '⏳ Navigating…');
        await new Promise(r => setTimeout(r, 3000));
        done = false; // continue the loop — content script will re-inject
        break;
      }
      results.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(r).slice(0, 2000) });
    }

    history.push({ role: 'user', content: results });
    if (done) break;
  }

  setActive(false);
  running = false;
  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();
}

sendBtn.onclick = () => { const g = inputEl.value.trim(); if (!g || running) return; inputEl.value = ''; run(g); };
inputEl.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } };
