/**
 * content.js — Page tools only (snapshot, click, fill, scroll, navigate)
 * UI lives in the sidepanel. This script handles tool execution requests
 * from background.js and returns results.
 */

const INTERACTIVE_SEL = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
const MAX_INTERACTIVE = 30;
const MAX_BODY_TEXT = 1200;

// ── Listen for tool requests from background ───────────────────────────────
browser.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TOOL_EXEC') {
    const result = execTool(message.name, message.input || {});
    browser.runtime.sendMessage({ type: 'TOOL_RESULT', reqId: message.reqId, result });
  }
});

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
    if (el.tagName === 'SELECT') { el.value = input.value; el.dispatchEvent(new Event('change', { bubbles: true })); return { ok: true, filled: input.selector }; }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, input.value); else el.value = input.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, filled: input.selector };
  }
  if (name === 'scroll') {
    window.scrollBy({ top: input.direction === 'up' ? -400 : 400, behavior: 'smooth' });
    return { ok: true, scrolled: input.direction };
  }
  if (name === 'navigate') {
    setTimeout(() => { window.location.href = input.url; }, 50);
    return { ok: true, navigated: input.url };
  }
  return { error: `Unknown tool: ${name}` };
}

// ── Snapshot ────────────────────────────────────────────────────────────────
function isFastVisible(el) {
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function labelFor(el) {
  return (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || el.placeholder || el.getAttribute('alt') || '').trim();
}
function stableSelector(el) {
  if (el.id) return '#' + CSS.escape(el.id);
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

console.log('[Webfuse WebMCP Demo] Content script active on', location.hostname);
