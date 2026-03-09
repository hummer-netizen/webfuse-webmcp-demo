/**
 * content.js — Webfuse WebMCP Bridge Demo
 * Floating AI agent chat panel with streaming responses and glowing UI.
 */

const MODEL = 'claude-3-haiku-20240307';
const MAX_TURNS = 10;

// ── Shadow DOM host ────────────────────────────────────────────────────────
const host = document.createElement('div');
host.id = 'webfuse-agent-host';
host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:system-ui,sans-serif;';
document.documentElement.appendChild(host);
const shadow = host.attachShadow({ mode: 'closed' });

// ── Styles ─────────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Glowing FAB ── */
  .fab {
    width: 60px; height: 60px; border-radius: 50%; border: none;
    background: linear-gradient(135deg, #7c3aed, #6366f1, #8b5cf6);
    color: #fff; font-size: 26px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    position: relative;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.5), 0 0 60px rgba(139, 92, 246, 0.2), 0 4px 14px rgba(0,0,0,.25);
    animation: fab-pulse 2.5s ease-in-out infinite;
    transition: transform .15s;
  }
  .fab:hover { transform: scale(1.1); }
  @keyframes fab-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.5), 0 0 60px rgba(139,92,246,0.2), 0 4px 14px rgba(0,0,0,.25); }
    50% { box-shadow: 0 0 30px rgba(139,92,246,0.7), 0 0 80px rgba(139,92,246,0.35), 0 4px 14px rgba(0,0,0,.25); }
  }

  /* ── Panel ── */
  .panel {
    display: none; width: 400px; height: 540px; border-radius: 16px;
    background: #1a1a2e; color: #e0e0e0;
    flex-direction: column; overflow: hidden; font-size: 14px;
    position: relative;
    border: 2px solid rgba(139, 92, 246, 0.3);
    box-shadow: 0 8px 32px rgba(0,0,0,.4), 0 0 0 1px rgba(139,92,246,0.1);
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .panel.open { display: flex; }

  /* Active glow on the whole border when agent is working */
  .panel.active {
    border-color: rgba(139, 92, 246, 0.8);
    box-shadow: 0 8px 32px rgba(0,0,0,.4), 0 0 30px rgba(139, 92, 246, 0.4), 0 0 60px rgba(139, 92, 246, 0.15);
    animation: border-glow 1.5s ease-in-out infinite;
  }
  @keyframes border-glow {
    0%, 100% { border-color: rgba(139,92,246,0.8); box-shadow: 0 8px 32px rgba(0,0,0,.4), 0 0 30px rgba(139,92,246,0.4), 0 0 60px rgba(139,92,246,0.15); }
    50% { border-color: rgba(167,139,250,1); box-shadow: 0 8px 32px rgba(0,0,0,.4), 0 0 45px rgba(139,92,246,0.6), 0 0 90px rgba(139,92,246,0.25); }
  }

  .header { padding: 12px 16px; background: #16162a; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(139,92,246,0.2); }
  .header .title { font-weight: 600; font-size: 14px; color: #c4b5fd; }
  .header button { background: none; border: none; color: #888; cursor: pointer; font-size: 18px; }
  .messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .msg { padding: 8px 12px; border-radius: 10px; max-width: 90%; word-wrap: break-word; line-height: 1.4; font-size: 13px; }
  .msg.user { background: #4f46e5; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
  .msg.agent { background: #1e1e38; color: #e0e0e0; align-self: flex-start; border: 1px solid rgba(139,92,246,0.15); border-bottom-left-radius: 4px; }
  .msg.system { color: #666; font-size: 11px; text-align: center; align-self: center; }
  .msg.error { color: #f87171; font-size: 12px; }
  .msg.thinking { color: #a78bfa; font-size: 12px; font-style: italic; }
  .action-pill { background: #2a2a44; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #a78bfa; }
  .input-row { padding: 10px 12px; background: #16162a; display: flex; gap: 8px; border-top: 1px solid rgba(139,92,246,0.2); }
  .input-row input { flex: 1; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(139,92,246,0.3); background: #1a1a2e; color: #e0e0e0; font-size: 13px; outline: none; }
  .input-row input:focus { border-color: #8b5cf6; box-shadow: 0 0 8px rgba(139,92,246,0.3); }
  .input-row button { padding: 8px 16px; border-radius: 10px; border: none; background: linear-gradient(135deg, #7c3aed, #6366f1); color: #fff; cursor: pointer; font-size: 13px; font-weight: 600; }
  .input-row button:disabled { opacity: .4; cursor: default; }
  .suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
  .suggestion { background: #1e1e38; border: 1px solid rgba(139,92,246,0.25); color: #c4b5fd; padding: 6px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: background .15s; }
  .suggestion:hover { background: #2a2a44; border-color: rgba(139,92,246,0.5); }
`;
shadow.appendChild(style);

// ── FAB button ─────────────────────────────────────────────────────────────
const fab = document.createElement('button');
fab.className = 'fab';
fab.textContent = '✨';
fab.title = 'Webfuse AI Agent';
shadow.appendChild(fab);

// ── Chat panel ─────────────────────────────────────────────────────────────
const panel = document.createElement('div');
panel.className = 'panel';
panel.innerHTML = `
  <div class="header">
    <span class="title">✨ Webfuse Agent</span>
    <button id="close-btn">✕</button>
  </div>
  <div class="messages" id="messages"></div>
  <div class="input-row">
    <input id="input" type="text" placeholder="Tell the agent what to do…" />
    <button id="send">Go</button>
  </div>
`;
shadow.appendChild(panel);

const messagesEl = shadow.getElementById('messages');
const inputEl = shadow.getElementById('input');
const sendBtn = shadow.getElementById('send');
const closeBtn = shadow.getElementById('close-btn');

let panelOpen = false;
fab.onclick = () => { panelOpen = !panelOpen; panel.classList.toggle('open', panelOpen); fab.style.display = panelOpen ? 'none' : 'flex'; if (panelOpen) inputEl.focus(); };
closeBtn.onclick = () => { panelOpen = false; panel.classList.remove('open'); fab.style.display = 'flex'; };

// ── Suggestions ────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  '🔍 Search for "AI agents"',
  '📄 Summarise this page',
  '🔗 Click the first link',
  '📰 List the section headings',
];
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
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
showSuggestions();

// ── Chat helpers ───────────────────────────────────────────────────────────
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
function setActive(on) { panel.classList.toggle('active', on); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Tools ──────────────────────────────────────────────────────────────────
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

// ── Page interaction: FAST snapshot ────────────────────────────────────────
const INTERACTIVE_SEL = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
const MAX_INTERACTIVE = 30;
const MAX_BODY_TEXT = 1200;

function isFastVisible(el) {
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function labelFor(el) {
  return (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || el.placeholder || el.getAttribute('alt') || '').trim();
}
function stableSelector(el) {
  if (el.id && el.id !== 'webfuse-agent-host') return '#' + CSS.escape(el.id);
  if (el.dataset?.testid) return `[data-testid="${CSS.escape(el.dataset.testid)}"]`;
  const aria = el.getAttribute('aria-label');
  if (aria) return `[aria-label="${CSS.escape(aria)}"]`;
  if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
  return positionalSelector(el, 0);
}
function positionalSelector(el, depth) {
  if (depth > 3 || !el || el === document.body) return el?.tagName?.toLowerCase() || '*';
  if (el.id) return '#' + CSS.escape(el.id);
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const siblings = parent.children;
  let pos = 0, sameTag = 0;
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].tagName === el.tagName) sameTag++;
    if (siblings[i] === el) { pos = sameTag; break; }
  }
  const parentSel = positionalSelector(parent, depth + 1);
  return sameTag === 1 ? `${parentSel} > ${tag}` : `${parentSel} > ${tag}:nth-of-type(${pos})`;
}
function visibleText(maxLen) {
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) { const p = node.parentElement; return (!p || skip.has(p.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  let text = '', node;
  while ((node = walker.nextNode()) && text.length < maxLen) { const t = node.textContent.trim(); if (t) text += (text ? ' ' : '') + t; }
  return text.slice(0, maxLen);
}
function takeSnapshot() {
  const t0 = performance.now();
  const interactive = [], seen = new Set();
  const elements = document.body.querySelectorAll(INTERACTIVE_SEL);
  for (let i = 0; i < elements.length && interactive.length < MAX_INTERACTIVE; i++) {
    const el = elements[i];
    if (el.closest('#webfuse-agent-host')) continue;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (!isFastVisible(el)) continue;
    const selector = stableSelector(el);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);
    const entry = { type: el.tagName.toLowerCase(), selector, text: labelFor(el).slice(0, 80) };
    if (el.tagName === 'INPUT') { entry.inputType = el.type || 'text'; if (el.placeholder) entry.placeholder = el.placeholder; }
    if (el.tagName === 'TEXTAREA' && el.placeholder) entry.placeholder = el.placeholder;
    if (el.tagName === 'SELECT') entry.options = Array.from(el.options).map(o => o.text).slice(0, 8);
    if (el.tagName === 'A' && el.href) entry.href = el.href.startsWith(location.origin) ? el.href.slice(location.origin.length) : el.href;
    interactive.push(entry);
  }
  const headings = [];
  document.querySelectorAll('h1,h2,h3').forEach(h => { if (headings.length < 8) { const t = h.innerText?.trim().slice(0, 60); if (t) headings.push({ level: h.tagName, text: t }); } });
  console.log(`[Webfuse] snapshot: ${interactive.length} elements, ${Math.round(performance.now() - t0)}ms`);
  return { url: location.href, title: document.title, readyState: document.readyState, headings, bodyText: visibleText(MAX_BODY_TEXT), interactive, scrollY: Math.round(scrollY), pageHeight: document.body.scrollHeight };
}

function resolveElement(selector) {
  try { const el = document.querySelector(selector); if (el) return el; } catch (_) {}
  const m = selector.match(/^(button|a)\[text="(.+)"\]$/);
  if (m) return Array.from(document.querySelectorAll(m[1])).find(el => el.innerText?.trim() === m[2]) || null;
  return null;
}
function execTool(name, input) {
  if (name === 'snapshot') return takeSnapshot();
  if (name === 'click') { const el = resolveElement(input.selector); if (!el) return { error: `Not found: ${input.selector}` }; el.focus(); el.click(); return { ok: true, clicked: input.selector }; }
  if (name === 'fill') {
    const el = resolveElement(input.selector); if (!el) return { error: `Not found: ${input.selector}` }; el.focus();
    if (el.tagName === 'SELECT') { el.value = input.value; el.dispatchEvent(new Event('change', { bubbles: true })); return { ok: true, filled: input.selector }; }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, input.value); else el.value = input.value;
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, filled: input.selector };
  }
  if (name === 'scroll') { window.scrollBy({ top: input.direction === 'up' ? -400 : 400, behavior: 'smooth' }); return { ok: true, scrolled: input.direction }; }
  if (name === 'navigate') { window.location.href = input.url; return { ok: true, navigated: input.url }; }
  return { error: `Unknown tool: ${name}` };
}

// ── Streaming Claude API via background script ─────────────────────────────
let _pendingClaude = {};
let _reqCounter = 0;

browser.runtime.onMessage.addListener((message) => {
  const reqId = message?.reqId;
  const pending = _pendingClaude[reqId];
  if (!pending) return;

  if (message.type === 'CLAUDE_RESPONSE') {
    // Error or non-streamed response
    delete _pendingClaude[reqId];
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.data);
  } else if (message.type === 'CLAUDE_STREAM') {
    // SSE event from background
    const evt = message.event;
    if (evt.type === 'content_block_delta') {
      const delta = evt.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        pending.textSoFar += delta.text;
        if (pending.onText) pending.onText(pending.textSoFar);
      } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
        pending.jsonSoFar += delta.partial_json;
      }
    } else if (evt.type === 'content_block_start') {
      const block = evt.content_block;
      if (block?.type === 'tool_use') {
        pending.currentTool = { id: block.id, name: block.name };
        pending.jsonSoFar = '';
      } else if (block?.type === 'text') {
        pending.textSoFar = '';
      }
    } else if (evt.type === 'content_block_stop') {
      if (pending.currentTool) {
        let input = {};
        try { input = JSON.parse(pending.jsonSoFar || '{}'); } catch (_) {}
        pending.toolUses.push({ type: 'tool_use', id: pending.currentTool.id, name: pending.currentTool.name, input });
        pending.currentTool = null;
        pending.jsonSoFar = '';
      }
      if (pending.textSoFar) {
        pending.textBlocks.push(pending.textSoFar);
        pending.textSoFar = '';
      }
    } else if (evt.type === 'message_delta') {
      pending.stopReason = evt.delta?.stop_reason;
    }
  } else if (message.type === 'CLAUDE_STREAM_END') {
    delete _pendingClaude[reqId];
    // Assemble final response in same format as non-streamed
    const content = [];
    for (const t of pending.textBlocks) content.push({ type: 'text', text: t });
    for (const tu of pending.toolUses) content.push(tu);
    pending.resolve({ content, stop_reason: pending.stopReason || 'end_turn' });
  }
});

function callClaude(messages, onText) {
  return new Promise((resolve, reject) => {
    const reqId = ++_reqCounter;
    _pendingClaude[reqId] = {
      resolve, reject, onText,
      textSoFar: '', jsonSoFar: '', textBlocks: [], toolUses: [],
      currentTool: null, stopReason: null,
    };
    setTimeout(() => {
      if (_pendingClaude[reqId]) { delete _pendingClaude[reqId]; reject(new Error('Timeout (30s)')); }
    }, 30000);
    browser.runtime.sendMessage({
      type: 'CLAUDE_API', reqId,
      payload: { model: MODEL, max_tokens: 512, system: SYSTEM, tools: TOOLS, messages }
    });
  });
}

// ── Agent loop ─────────────────────────────────────────────────────────────
let running = false;

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
        // Live-update streamed text
        if (!streamMsg) { thinking.remove(); streamMsg = addMsg('agent', ''); }
        streamMsg.textContent = textSoFar;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    } catch (e) { thinking.remove(); addMsg('error', `❌ ${e.message}`); break; }

    if (!streamMsg) thinking.remove();

    // Show any remaining text blocks not shown via stream
    if (!streamMsg) {
      claude.content.filter(b => b.type === 'text' && b.text.trim()).forEach(b => addMsg('agent', b.text.trim()));
    }

    if (claude.stop_reason === 'end_turn') break;

    const uses = claude.content.filter(b => b.type === 'tool_use');
    if (!uses.length) break;

    history.push({ role: 'assistant', content: claude.content });
    const results = [];
    let done = false;

    for (const { id, name, input } of uses) {
      addAction(name, input);
      if (name === 'done') { addMsg('agent', `✅ ${input.summary}`); results.push({ type: 'tool_result', tool_use_id: id, content: 'Done.' }); done = true; break; }
      await new Promise(r => setTimeout(r, 0));
      let r = execTool(name, input);
      if (name === 'navigate') { results.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(r).slice(0, 2000) }); done = true; break; }
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

console.log('[Webfuse WebMCP Demo] Agent widget active on', location.hostname);
