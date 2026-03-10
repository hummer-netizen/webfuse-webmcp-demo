/**
 * content.js — Page tools + WebMCP Hub tool execution
 * Handles: snapshot, click, fill, scroll, navigate (generic Webfuse tools)
 *          + hub tool execution (selectors/actions from webmcp-hub.com configs)
 * On navigation: requests hub lookup from background.js
 */

const INTERACTIVE_SEL = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
const MAX_INTERACTIVE = 30;
const MAX_BODY_TEXT = 1200;

// Current hub configs for this page
let currentHubConfigs = [];
let currentHubTools = [];

// On page load: ask background for the real domain (URLs are rewritten by the Webfuse proxy)
const hubReqId = 'hub_' + Date.now();
browser.runtime.sendMessage({ type: 'GET_REAL_DOMAIN', reqId: hubReqId });

// Listen for tool requests
browser.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TOOL_EXEC') {
    const result = execTool(message.name, message.input || {});
    browser.runtime.sendMessage({ type: 'TOOL_RESULT', reqId: message.reqId, result });
  }
  if (message?.type === 'REAL_DOMAIN' && message.reqId === hubReqId) {
    // Got the real domain from Session API, now look up hub configs
    console.log('[Webfuse] Real domain:', message.domain, '(proxied as:', location.hostname + ')');
    browser.runtime.sendMessage({ type: 'HUB_LOOKUP', reqId: hubReqId, domain: message.domain });
  }
  if (message?.type === 'HUB_RESULT' && message.reqId === hubReqId) {
    currentHubConfigs = message.configs || [];
    currentHubTools = [];
    for (const config of currentHubConfigs) {
      for (const tool of (config.tools || [])) {
        currentHubTools.push({ ...tool, _configTitle: config.title, _urlPattern: config.urlPattern });
      }
    }
    if (currentHubTools.length > 0) {
      console.log(`[Webfuse] Hub: ${currentHubTools.length} tools loaded for ${location.hostname}`);
    }
  }
  if (message?.type === 'HUB_EXEC') {
    const result = execHubTool(message.name, message.input || {}, message.execution);
    browser.runtime.sendMessage({ type: 'TOOL_RESULT', reqId: message.reqId, result });
  }
});

// Generic Webfuse tools
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
    if (el.tagName === 'SELECT') { el.value = input.value; el.dispatchEvent(new Event('change', { bubbles: true })); return { ok: true }; }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, input.value); else el.value = input.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, filled: input.selector };
  }
  if (name === 'scroll') {
    window.scrollBy({ top: input.direction === 'up' ? -400 : 400, behavior: 'smooth' });
    return { ok: true };
  }
  if (name === 'navigate') {
    setTimeout(() => { window.location.href = input.url; }, 50);
    return { ok: true, navigated: input.url };
  }
  // Check if it's a hub tool
  const hubTool = currentHubTools.find(t => `hub_${t.name}` === name);
  if (hubTool && hubTool.execution) {
    return execHubTool(hubTool.name, input, hubTool.execution);
  }
  return { error: `Unknown tool: ${name}` };
}

// Execute a WebMCP Hub tool using its execution metadata
function execHubTool(name, input, execution) {
  if (!execution) return { error: `No execution metadata for hub tool: ${name}` };

  try {
    // Handle field-based tools (form fills)
    if (execution.fields && execution.fields.length > 0) {
      for (const field of execution.fields) {
        const value = input[field.name];
        if (value === undefined) continue;
        const el = resolveElement(field.selector);
        if (!el) return { error: `Hub tool "${name}": element not found for field "${field.name}" (${field.selector})` };
        el.focus();
        if (field.type === 'textarea' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, value); else el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (field.type === 'select' || el.tagName === 'SELECT') {
          el.value = value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      // Auto-submit if configured
      if (execution.autosubmit) {
        const submit = resolveElement(execution.selector);
        if (submit) { submit.click(); }
      }
      return { ok: true, hubTool: name, action: 'filled fields' };
    }

    // Handle step-based tools (click sequences)
    if (execution.steps && execution.steps.length > 0) {
      for (const step of execution.steps) {
        if (step.action === 'click') {
          const el = resolveElement(step.selector);
          if (!el) return { error: `Hub tool "${name}": element not found (${step.selector})` };
          el.focus();
          el.click();
        } else if (step.action === 'fill' && step.selector && input.text) {
          const el = resolveElement(step.selector);
          if (!el) return { error: `Hub tool "${name}": element not found (${step.selector})` };
          el.focus();
          const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, input.text); else el.value = input.text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      return { ok: true, hubTool: name, action: 'executed steps' };
    }

    // Simple click on selector
    if (execution.selector) {
      const el = resolveElement(execution.selector);
      if (!el) return { error: `Hub tool "${name}": element not found (${execution.selector})` };
      el.click();
      return { ok: true, hubTool: name, action: 'clicked' };
    }

    return { error: `Hub tool "${name}": no executable actions in config` };
  } catch (e) {
    return { error: `Hub tool "${name}" failed: ${e.message}` };
  }
}

// Snapshot (enhanced: includes hub tools if available)
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

  const snapshot = {
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    headings,
    bodyText: visibleText(MAX_BODY_TEXT),
    interactive,
    scrollY: Math.round(scrollY),
    pageHeight: document.body.scrollHeight
  };

  // Add hub tools if available for this domain
  if (currentHubTools.length > 0) {
    snapshot.hubTools = currentHubTools.map(t => ({
      name: `hub_${t.name}`,
      description: t.description,
      args: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
      source: 'webmcp-hub.com'
    }));
    snapshot.hubNote = `${currentHubTools.length} community-contributed tools available for ${location.hostname}. Use hub_* tools for pre-mapped actions (faster, more reliable). Use generic tools (click, fill) as fallback.`;
  }

  console.log(`[Webfuse] snapshot: ${interactive.length} elements, ${currentHubTools.length} hub tools, ${Math.round(performance.now() - t0)}ms`);
  return snapshot;
}

// Helper functions
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
function resolveElement(selector) {
  try { const el = document.querySelector(selector); if (el) return el; } catch (_) {}
  const m = selector.match(/^(button|a)\[text="(.+)"\]$/);
  if (m) return Array.from(document.querySelectorAll(m[1])).find(el => el.innerText?.trim() === m[2]) || null;
  return null;
}

console.log('[Webfuse WebMCP Demo] Content v3.0 — Hub tools + page tools on', location.hostname);
