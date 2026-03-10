/**
 * sidepanel.js — Persistent agent chat UI + WebMCP Hub integration
 * Communicates with background.js for API calls, and content.js for page tools.
 * Dynamically adds hub tools when available for the current domain.
 */

const MODEL = 'claude-sonnet-4-6';
const MAX_TURNS = 10;

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');

let running = false;

// Base tools (always available)
const BASE_TOOLS = [
  { name: 'snapshot', description: 'Get page state: URL, title, headings, visible text, interactive elements with CSS selectors. Also shows available hub tools if any.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'click', description: 'Click an element by CSS selector.', input_schema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'fill', description: 'Fill a form field with a value.', input_schema: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] } },
  { name: 'navigate', description: 'Navigate to a URL.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'scroll', description: 'Scroll the page up or down.', input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'] } },
  { name: 'done', description: 'Signal task complete.', input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } },
];

// Hub tools (added dynamically per domain)
let hubToolDefs = [];
let currentDomain = '';

const BASE_SYSTEM = `You are a web automation agent inside a Webfuse-proxied browser session. You have direct, structured access to the live page. Real auth, real cookies, real state.

Rules:
1. Start every task with snapshot()
2. Prefer stable selectors: id > data-testid > aria-label > name > positional
3. After each action, snapshot again to verify the result
4. On failure, try an alternative selector or approach before giving up
5. Be efficient. Act, don't over-explain.
6. Call done() with a one-sentence summary when the task is complete`;

const HUB_SYSTEM_ADDON = `

IMPORTANT: This page has community-contributed WebMCP Hub tools available (prefixed with hub_). These are pre-mapped to specific UI elements and are faster and more reliable than generic click/fill. PREFER hub tools when they match your intent. Fall back to generic tools only when no hub tool fits.`;

function getSystem() {
  return hubToolDefs.length > 0 ? BASE_SYSTEM + HUB_SYSTEM_ADDON : BASE_SYSTEM;
}

function getTools() {
  return [...hubToolDefs, ...BASE_TOOLS];
}

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
  const isHub = name.startsWith('hub_');
  d.innerHTML = `<span class="action-pill ${isHub ? 'hub' : ''}">${isHub ? '🌐 ' : ''}${name}(${args})</span>`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function setActive(on) {
  document.body.classList.toggle('active', on);
  statusEl.textContent = on ? 'working…' : 'ready';
  statusEl.classList.toggle('thinking', on);
}

// ── Hub tools notification ─────────────────────────────────────────────────
function updateHubBadge() {
  const badge = document.getElementById('hub-badge');
  if (!badge) return;
  if (hubToolDefs.length > 0) {
    badge.textContent = `🌐 ${hubToolDefs.length} hub tools`;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// ── Hub tools display ───────────────────────────────────────────────────────
function addHubToolsMsg(domain, tools) {
  const d = document.createElement('div');
  d.className = 'msg hub-tools-list';
  d.innerHTML = `<div class="hub-header">🌐 ${tools.length} community tools for <strong>${domain}</strong></div>` +
    tools.map(t => `<span class="hub-tool-tag">${t.name}</span>`).join('') +
    `<div class="hub-source">from webmcp-hub.com</div>`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
  addMsg('system', 'Powered by Webfuse + Claude + WebMCP Hub · webfuse.com');
}
showSuggestions();

// ── Message handling ───────────────────────────────────────────────────────
let _toolPending = {};
let _toolReqId = 0;
let _claudePending = {};
let _claudeReqId = 0;

browser.runtime.onMessage.addListener((message) => {
  // Tool results from content script
  if (message?.type === 'TOOL_RESULT' && _toolPending[message.reqId]) {
    const { resolve } = _toolPending[message.reqId];
    delete _toolPending[message.reqId];
    resolve(message.result);
  }

  // Hub tools updated for new domain
  if (message?.type === 'HUB_TOOLS_UPDATED') {
    currentDomain = message.domain;
    const configs = message.configs || [];
    hubToolDefs = [];
    for (const config of configs) {
      for (const tool of (config.tools || [])) {
        hubToolDefs.push({
          name: `hub_${tool.name}`,
          description: `[WebMCP Hub] ${tool.description || tool.name}`,
          input_schema: tool.inputSchema || { type: 'object', properties: {} },
          _execution: tool.execution,
        });
      }
    }
    updateHubBadge();
    if (hubToolDefs.length > 0) {
      const toolList = hubToolDefs.map(t => t.name).join(', ');
      addHubToolsMsg(currentDomain, hubToolDefs);
    }
  }

  // Claude streaming
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

function callClaude(messages, onText) {
  return new Promise((resolve, reject) => {
    const reqId = 'sp_' + (++_claudeReqId);
    _claudePending[reqId] = {
      resolve, reject, onText,
      textSoFar: '', jsonSoFar: '', textBlocks: [], toolUses: [],
      currentTool: null, stopReason: null,
    };
    setTimeout(() => { if (_claudePending[reqId]) { delete _claudePending[reqId]; reject(new Error('Timeout (30s)')); } }, 30000);

    // Build tools list: base + hub (strip _execution from hub tools before sending to API)
    const tools = getTools().map(t => {
      const { _execution, ...rest } = t;
      return rest;
    });

    browser.runtime.sendMessage({
      type: 'CLAUDE_API', reqId,
      payload: { model: MODEL, max_tokens: 1024, system: getSystem(), tools, messages }
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
        addMsg('system', '⏳ Navigating…');
        await new Promise(r => setTimeout(r, 3000));
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
