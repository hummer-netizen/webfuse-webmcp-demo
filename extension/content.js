/**
 * content.js — Webfuse Extension content script
 * Injected into the proxied website. Provides the agent with
 * "eyes" (page snapshot) and "hands" (click, fill, navigate).
 *
 * Communicates with popup.js via chrome.runtime messaging.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;
  try {
    switch (type) {
      case 'SNAPSHOT':  sendResponse({ ok: true, result: takeSnapshot() }); break;
      case 'CLICK':     sendResponse(performClick(payload.selector)); break;
      case 'FILL':      sendResponse(performFill(payload.selector, payload.value)); break;
      case 'NAVIGATE':
        sendResponse({ ok: true });
        setTimeout(() => { window.location.href = payload.url; }, 50);
        break;
      case 'SCROLL':    sendResponse(performScroll(payload.direction)); break;
      default:          sendResponse({ error: `Unknown action: ${type}` });
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
  return true;
});

function collectInteractive(root) {
  const results = [];
  const selector = 'a, button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [onclick]';
  try { results.push(...Array.from(root.querySelectorAll(selector))); } catch (_) {}
  // Walk shadow roots recursively
  root.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) results.push(...collectInteractive(el.shadowRoot));
  });
  return results;
}

function takeSnapshot() {
  const interactive = [];
  const seen = new Set();

  // Collect elements from main DOM + shadow roots
  const allElements = collectInteractive(document.body);
  allElements.forEach((el) => {
    if (!isVisible(el)) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const selector = stableSelector(el);
    if (!selector || seen.has(selector)) return;
    seen.add(selector);

    const entry = {
      type: el.tagName.toLowerCase(),
      selector,
      text: labelFor(el).slice(0, 120),
    };
    const role = el.getAttribute('role');
    if (role) entry.role = role;
    if (el.tagName === 'INPUT') {
      entry.inputType = el.type || 'text';
      if (el.value) entry.value = el.value;
      if (el.placeholder) entry.placeholder = el.placeholder;
    }
    if (el.tagName === 'TEXTAREA' && el.placeholder) entry.placeholder = el.placeholder;
    if (el.tagName === 'SELECT') {
      entry.options = Array.from(el.options).map(o => o.text).slice(0, 10);
    }
    if (el.tagName === 'A' && el.href) {
      entry.href = el.href.startsWith(location.origin)
        ? el.href.slice(location.origin.length)
        : el.href;
    }
    interactive.push(entry);
  });

  const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
    .filter(isVisible)
    .map(h => ({ level: h.tagName, text: h.innerText.trim().slice(0, 80) }))
    .slice(0, 10);

  return {
    url: window.location.href,
    title: document.title,
    readyState: document.readyState,         // 'loading'|'interactive'|'complete'
    headings,
    bodyText: visibleText().slice(0, 3000),
    interactive: interactive.slice(0, 60),
    scrollY: Math.round(window.scrollY),
    pageHeight: document.body.scrollHeight,
  };
}

function visibleText() {
  const skip = new Set(['SCRIPT','STYLE','NOSCRIPT','HEADER','NAV','FOOTER']);
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (!node.tagName || skip.has(node.tagName)) return '';
    return Array.from(node.childNodes).map(walk).join(' ');
  }
  return walk(document.body).replace(/\s+/g, ' ').trim();
}

function labelFor(el) {
  return (
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.innerText ||
    el.value ||
    el.placeholder ||
    el.getAttribute('alt') ||
    ''
  ).trim();
}

function performClick(selector) {
  const el = resolveElement(selector);
  if (!el) return { error: `Element not found: ${selector}` };
  el.focus();
  el.click();
  return { ok: true, clicked: selector };
}

function performFill(selector, value) {
  const el = resolveElement(selector);
  if (!el) return { error: `Element not found: ${selector}` };
  el.focus();
  if (el.tagName === 'SELECT') {
    // For <select>: set value directly and dispatch change
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, filled: selector, value, selectedText: el.options[el.selectedIndex]?.text };
  }
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, filled: selector, value };
}

function performScroll(direction) {
  const amount = direction === 'up' ? -400 : 400;
  window.scrollBy({ top: amount, behavior: 'smooth' });
  return { ok: true, scrolled: direction };
}

/** Resolve a selector — handles both CSS and text-based fallback hints */
function resolveElement(selector) {
  // Try as standard CSS first
  try {
    const el = document.querySelector(selector);
    if (el) return el;
  } catch (_) {}

  // Fallback: if selector looks like a text hint, find by text
  const textMatch = selector.match(/^(button|a)\[text="(.+)"\]$/);
  if (textMatch) {
    const [, tag, text] = textMatch;
    return Array.from(document.querySelectorAll(tag))
      .find(el => el.innerText?.trim() === text) || null;
  }
  return null;
}

function isVisible(el) {
  if (!el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const s = window.getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
}

/**
 * Stable CSS selector — always returns valid CSS document.querySelector can handle.
 * Priority: id > data-testid > aria-label > name > text-hint > positional
 */
function stableSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;

  if (el.dataset?.testid)
    return `[data-testid="${CSS.escape(el.dataset.testid)}"]`;

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel)
    return `[aria-label="${CSS.escape(ariaLabel)}"]`;

  if (el.name)
    return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;

  // For buttons/links: generate a text-based selector hint (custom format the agent can use)
  // resolveElement() handles these on the other side
  const tag = el.tagName.toLowerCase();
  const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if ((tag === 'button' || tag === 'a') && text) {
    // Check it's unique before using text-based
    const all = Array.from(document.querySelectorAll(tag));
    const matches = all.filter(e => (e.innerText || '').trim() === text);
    if (matches.length === 1) return `${tag}[text="${text.replace(/"/g, '\\"')}"]`;
  }

  return positionalSelector(el, 0);
}

function positionalSelector(el, depth) {
  if (depth > 4 || !el || el === document.body) return el?.tagName?.toLowerCase() || '*';
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
  const pos = siblings.indexOf(el) + 1;
  const parentSel = positionalSelector(parent, depth + 1);
  return siblings.length === 1
    ? `${parentSel} > ${tag}`
    : `${parentSel} > ${tag}:nth-child(${pos})`;
}

console.log('[Webfuse WebMCP Demo] Content script active on', window.location.hostname);
