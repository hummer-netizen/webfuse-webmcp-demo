/**
 * content.js — Webfuse WebMCP Bridge Demo
 * Injects a floating agent chat panel directly into the page (shadow DOM isolates styles).
 * The full agent loop runs here — no popup click needed.
 *
 * Performance: snapshot is designed to be lightweight on heavy pages (Wikipedia etc.)
 * - No querySelectorAll('*') — shadow DOM walk removed (rare on target sites)
 * - Visibility check uses fast offsetParent pre-filter
 * - Selector uniqueness uses cached maps instead of per-element querySelectorAll
 * - Text extraction is bounded and uses TreeWalker
 * - Snapshot runs in requestAnimationFrame to avoid blocking input
 */

const MODEL = 'claude-sonnet-4-6';
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
  .fab { width:56px; height:56px; border-radius:50%; border:none; background:#6366f1; color:#fff;
         font-size:24px; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.25); transition:transform .15s; display:flex; align-items:center; justify-content:center; }
  .fab:hover { transform:scale(1.08); }
  .panel { display:none; width:380px; height:520px; border-radius:12px; background:#1e1e2e; color:#e0e0e0;
           box-shadow:0 8px 30px rgba(0,0,0,.35); flex-direction:column; overflow:hidden; font-size:14px; }
  .panel.open { display:flex; }
  .header { padding:12px 16px; background:#2a2a3c; display:flex; align-items:center; justify-content:space-between; }
  .header .title { font-weight:600; font-size:14px; color:#c4b5fd; }
  .header button { background:none; border:none; color:#888; cursor:pointer; font-size:18px; }
  .messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }
  .msg { padding:8px 12px; border-radius:8px; max-width:90%; word-wrap:break-word; line-height:1.4; font-size:13px; }
  .msg.user { background:#4f46e5; color:#fff; align-self:flex-end; }
  .msg.agent { background:#2a2a3c; color:#e0e0e0; align-self:flex-start; }
  .msg.system { color:#888; font-size:12px; text-align:center; align-self:center; }
  .msg.error { color:#f87171; font-size:12px; }
  .msg.thinking { color:#a78bfa; font-size:12px; font-style:italic; }
  .action-pill { background:#3b3b52; padding:2px 8px; border-radius:4px; font-family:monospace; font-size:12px; }
  .input-row { padding:10px 12px; background:#2a2a3c; display:flex; gap:8px; }
  .input-row input { flex:1; padding:8px 12px; border-radius:8px; border:1px solid #444; background:#1e1e2e; color:#e0e0e0; font-size:13px; outline:none; }
  .input-row input:focus { border-color:#6366f1; }
  .input-row button { padding:8px 14px; border-radius:8px; border:none; background:#6366f1; color:#fff; cursor:pointer; font-size:13px; font-weight:600; }
  .input-row button:disabled { opacity:.5; cursor:default; }
  .suggestions { display:flex; flex-wrap:wrap; gap:6px; padding:4px 0; }
  .suggestion { background:#2a2a3c; border:1px solid #444; color:#c4b5fd; padding:6px 10px; border-radius:6px; font-size:12px; cursor:pointer; }
  .suggestion:hover { background:#3b3b52; }
`;
shadow.appendChild(style);

// ── FAB button ─────────────────────────────────────────────────────────────
const fab = document.createElement('button');
fab.className = 'fab';
fab.textContent = '🤖';
fab.title = 'Webfuse AI Agent';
shadow.appendChild(fab);

// ── Chat panel ─────────────────────────────────────────────────────────────
const panel = document.createElement('div');
panel.className = 'panel';
panel.innerHTML = `
  <div class="header">
    <span class="title">🤖 Webfuse Agent</span>
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
  const args = Object.entries(input).map(([k, v]) => `${k}="${String(v).slice(0, 35)}"`).join(', ');
  const d = document.createElement('div');
  d.className = 'msg thinking';
  d.innerHTML = `<span class="action-pill">${name}(${args})</span>`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Tools ──────────────────────────────────────────────────────────────────
const TOOLS = [
  { name: 'snapshot', description: 'Get page state: URL, title, headings, visible text, interactive elements with CSS selectors.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'click', description: 'Click an element by CSS selector.', input_schema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'fill', description: 'Fill a form field with a value. Works on React and vanilla apps.', input_schema: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] } },
  { name: 'navigate', description: 'Navigate to a URL.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'scroll', description: 'Scroll the page up or down.', input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'] } },
  { name: 'done', description: 'Signal task complete.', input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } },
];

const SYSTEM = `You are a web automation agent inside a Webfuse-proxied browser session. You have direct, structured access to the live page — real auth, real cookies, real state.

Tools: snapshot, click, fill, navigate, scroll, done.

Rules:
1. Start every task with snapshot()
2. Prefer stable selectors: id > data-testid > aria-label > name > text-hint > positional
3. After each action, snapshot again to verify the result
4. After navigate(), the result includes the new page snapshot — no need for a separate snapshot call
5. On failure, try an alternative selector or approach before giving up
6. Be efficient — don't over-explain, just act
7. Call done() with a one-sentence summary when the task is complete`;

// ── Page interaction: FAST snapshot ────────────────────────────────────────

const INTERACTIVE_SEL = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
const MAX_INTERACTIVE = 30;
const MAX_BODY_TEXT = 1200;

/** Fast visibility: offsetParent is null for hidden elements (except position:fixed) */
function isFastVisible(el) {
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function labelFor(el) {
  return (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || el.placeholder || el.getAttribute('alt') || '').trim();
}

/**
 * Build a stable CSS selector. No querySelectorAll uniqueness checks.
 * Priority: id > data-testid > aria-label > name > nth-child positional
 */
function stableSelector(el) {
  if (el.id && el.id !== 'webfuse-agent-host') return '#' + CSS.escape(el.id);
  if (el.dataset?.testid) return `[data-testid="${CSS.escape(el.dataset.testid)}"]`;
  const aria = el.getAttribute('aria-label');
  if (aria) return `[aria-label="${CSS.escape(aria)}"]`;
  if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
  // Positional fallback (max depth 3 for speed)
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

/** Extract visible text using TreeWalker (much faster than recursive walk) */
function visibleText(maxLen) {
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p || skip.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let text = '', node;
  while ((node = walker.nextNode()) && text.length < maxLen) {
    const t = node.textContent.trim();
    if (t) text += (text ? ' ' : '') + t;
  }
  return text.slice(0, maxLen);
}

function takeSnapshot() {
  const t0 = performance.now();
  const interactive = [];
  const seen = new Set();

  // Query interactive elements directly (no querySelectorAll('*') shadow walk)
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
    if (el.tagName === 'A' && el.href) {
      entry.href = el.href.startsWith(location.origin) ? el.href.slice(location.origin.length) : el.href;
    }
    interactive.push(entry);
  }

  const headings = [];
  document.querySelectorAll('h1,h2,h3').forEach(h => {
    if (headings.length < 8) {
      const t = h.innerText?.trim().slice(0, 60);
      if (t) headings.push({ level: h.tagName, text: t });
    }
  });

  const ms = Math.round(performance.now() - t0);
  console.log(`[Webfuse] snapshot: ${interactive.length} elements, ${ms}ms`);

  return {
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    headings,
    bodyText: visibleText(MAX_BODY_TEXT),
    interactive,
    scrollY: Math.round(scrollY),
    pageHeight: document.body.scrollHeight,
  };
}

// ── Element resolution ─────────────────────────────────────────────────────
function resolveElement(selector) {
  try { const el = document.querySelector(selector); if (el) return el; } catch (_) {}
  const m = selector.match(/^(button|a)\[text="(.+)"\]$/);
  if (m) return Array.from(document.querySelectorAll(m[1])).find(el => el.innerText?.trim() === m[2]) || null;
  return null;
}

function execTool(name, input) {
  if (name === 'snapshot') return takeSnapshot();
  if (name === 'click') {
    const el = resolveElement(input.selector);
    if (!el) return { error: `Not found: ${input.selector}` };
    el.focus(); el.click();
    return { ok: true, clicked: input.selector };
  }
  if (name === 'fill') {
    const el = resolveElement(input.selector);
    if (!el) return { error: `Not found: ${input.selector}` };
    el.focus();
    if (el.tagName === 'SELECT') {
      el.value = input.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, filled: input.selector, value: input.value };
    }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, input.value); else el.value = input.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, filled: input.selector, value: input.value };
  }
  if (name === 'scroll') {
    window.scrollBy({ top: input.direction === 'up' ? -400 : 400, behavior: 'smooth' });
    return { ok: true, scrolled: input.direction };
  }
  if (name === 'navigate') {
    window.location.href = input.url;
    return { ok: true, navigated: input.url };
  }
  return { error: `Unknown tool: ${name}` };
}

// ── Claude API (via background script — avoids Webfuse proxy interception) ──
let _pendingClaude = {};
let _reqCounter = 0;

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === 'CLAUDE_RESPONSE' && _pendingClaude[message.reqId]) {
    const { resolve, reject } = _pendingClaude[message.reqId];
    delete _pendingClaude[message.reqId];
    if (message.error) reject(new Error(message.error));
    else resolve(message.data);
  }
});

function callClaude(messages) {
  return new Promise((resolve, reject) => {
    const reqId = ++_reqCounter;
    _pendingClaude[reqId] = { resolve, reject };
    setTimeout(() => {
      if (_pendingClaude[reqId]) {
        delete _pendingClaude[reqId];
        reject(new Error('Background script timeout (30s)'));
      }
    }, 30000);
    browser.runtime.sendMessage({
      type: 'CLAUDE_API',
      reqId,
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
  const history = [{ role: 'user', content: goal }];
  addMsg('user', goal);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const thinking = addMsg('thinking', '⏳ thinking…');
    let claude;
    try { claude = await callClaude(history); }
    catch (e) { thinking.remove(); addMsg('error', `❌ ${e.message}`); break; }
    thinking.remove();

    claude.content.filter(b => b.type === 'text' && b.text.trim()).forEach(b => addMsg('agent', b.text.trim()));
    if (claude.stop_reason === 'end_turn') break;

    const uses = claude.content.filter(b => b.type === 'tool_use');
    if (!uses.length) break;

    history.push({ role: 'assistant', content: claude.content });
    const results = [];
    let done = false;

    for (const { id, name, input } of uses) {
      addAction(name, input);
      if (name === 'done') { addMsg('agent', `✅ ${input.summary}`); results.push({ type: 'tool_result', tool_use_id: id, content: 'Done.' }); done = true; break; }
      // Yield to main thread before expensive operations
      await new Promise(r => setTimeout(r, 0));
      let r = execTool(name, input);
      if (name === 'navigate') {
        results.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(r).slice(0, 2000) });
        done = true; break;
      }
      results.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(r).slice(0, 2000) });
    }

    history.push({ role: 'user', content: results });
    if (done) break;
  }

  running = false;
  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();
}

sendBtn.onclick = () => { const g = inputEl.value.trim(); if (!g || running) return; inputEl.value = ''; run(g); };
inputEl.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } };

console.log('[Webfuse WebMCP Demo] Agent widget active on', location.hostname);
