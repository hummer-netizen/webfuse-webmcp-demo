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
      case 'SNAPSHOT':
        sendResponse({ ok: true, result: takeSnapshot() });
        break;
      case 'CLICK':
        sendResponse(performClick(payload.selector));
        break;
      case 'FILL':
        sendResponse(performFill(payload.selector, payload.value));
        break;
      case 'NAVIGATE':
        // Navigate async — respond first, then navigate
        sendResponse({ ok: true });
        setTimeout(() => { window.location.href = payload.url; }, 50);
        break;
      default:
        sendResponse({ error: `Unknown action: ${type}` });
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }

  return true; // keep channel open for async
});

/**
 * Generate a compact, LLM-readable snapshot of the current page state.
 * Captures: title, URL, visible text, interactive elements with stable selectors.
 * Includes ARIA labels and roles for better LLM comprehension.
 */
function takeSnapshot() {
  const interactive = [];
  const seen = new Set();

  document.querySelectorAll(
    'a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [onclick]'
  ).forEach((el, i) => {
    if (!isVisible(el)) return;

    const selector = stableSelector(el);
    if (seen.has(selector)) return;
    seen.add(selector);

    const entry = {
      type: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || undefined,
      selector,
      text: labelFor(el).slice(0, 120),
    };

    if (el.tagName === 'INPUT') {
      entry.inputType = el.type || 'text';
      if (el.value) entry.value = el.value;
    }
    if (el.tagName === 'SELECT') {
      entry.options = Array.from(el.options).map(o => o.text).slice(0, 10);
    }
    if (el.href) entry.href = el.href.replace(window.location.origin, '');

    interactive.push(entry);
  });

  // Headings for structure context
  const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
    .filter(isVisible)
    .map(h => ({ level: h.tagName, text: h.innerText.trim().slice(0, 80) }))
    .slice(0, 10);

  return {
    url: window.location.href,
    title: document.title,
    headings,
    bodyText: visibleText().slice(0, 3000),
    interactive: interactive.slice(0, 60),
  };
}

/** Extract meaningful visible text, skipping nav/footer noise */
function visibleText() {
  const skip = new Set(['SCRIPT','STYLE','NOSCRIPT','HEADER','NAV','FOOTER']);
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (skip.has(node.tagName)) return '';
    return Array.from(node.childNodes).map(walk).join(' ');
  };
  return (walk(document.body) || '').replace(/\s+/g, ' ').trim();
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
  const el = document.querySelector(selector);
  if (!el) return { error: `Element not found: ${selector}` };
  el.focus();
  el.click();
  return { ok: true, clicked: selector };
}

function performFill(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return { error: `Element not found: ${selector}` };
  el.focus();
  // Handle React-controlled inputs (nativeInputValueSetter trick)
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, filled: selector, value };
}

function isVisible(el) {
  if (!el.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

/**
 * Generate a stable, readable CSS selector.
 * Priority: id > data-testid > aria-label > name > role+text > positional
 */
function stableSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset?.testid) return `[data-testid="${CSS.escape(el.dataset.testid)}"]`;
  if (el.getAttribute('aria-label')) return `[aria-label="${CSS.escape(el.getAttribute('aria-label'))}"]`;
  if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;

  // Role + text for buttons/links (readable for LLM)
  const tag = el.tagName.toLowerCase();
  const text = (el.innerText || '').trim().slice(0, 30).replace(/"/g, '\\"');
  if ((tag === 'button' || tag === 'a') && text) {
    // Check uniqueness
    const candidates = document.querySelectorAll(`${tag}`);
    const matches = Array.from(candidates).filter(c => (c.innerText || '').trim().startsWith(text.slice(0, 20)));
    if (matches.length === 1) return `${tag}:has-text("${text}")`; // descriptive (not valid CSS but meaningful for LLM)
  }

  // Positional fallback — walk up to a stable ancestor
  return positionalSelector(el);
}

function positionalSelector(el, depth = 0) {
  if (depth > 4 || !el || el === document.body) return el?.tagName?.toLowerCase() || 'body';
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${CSS.escape(el.id)} ${tag}`;
  const parent = el.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
  if (siblings.length === 1) return `${positionalSelector(parent, depth + 1)} > ${tag}`;
  const pos = siblings.indexOf(el) + 1;
  return `${positionalSelector(parent, depth + 1)} > ${tag}:nth-child(${pos})`;
}

console.log('[Webfuse WebMCP Demo] Content script active on', window.location.hostname);
