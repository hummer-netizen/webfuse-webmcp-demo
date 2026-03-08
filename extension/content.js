/**
 * content.js — Webfuse Extension content script
 * Injected into the proxied website. Provides the agent with
 * "eyes" (page snapshot) and "hands" (click, fill, navigate).
 */

// Expose agent API to the popup via message passing
window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data?.type) return;

  const { type, payload, id } = event.data;
  let result;

  try {
    switch (type) {
      case 'SNAPSHOT':
        result = takeSnapshot();
        break;
      case 'CLICK':
        result = performClick(payload.selector);
        break;
      case 'FILL':
        result = performFill(payload.selector, payload.value);
        break;
      case 'NAVIGATE':
        window.location.href = payload.url;
        result = { ok: true };
        break;
      default:
        result = { error: `Unknown action: ${type}` };
    }
  } catch (e) {
    result = { error: e.message };
  }

  window.postMessage({ type: `${type}_RESULT`, result, id }, '*');
});

/**
 * Generate a compact, LLM-readable snapshot of the current page state.
 * Captures: title, URL, visible text, interactive elements with selectors.
 */
function takeSnapshot() {
  const interactive = [];
  const seen = new Set();

  // Collect all interactive elements
  document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick]').forEach((el, i) => {
    if (!isVisible(el)) return;

    const selector = generateSelector(el, i);
    if (seen.has(selector)) return;
    seen.add(selector);

    const entry = {
      type: el.tagName.toLowerCase(),
      selector,
      text: (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 100),
    };

    if (el.tagName === 'INPUT') {
      entry.inputType = el.type;
      entry.value = el.value;
    }
    if (el.href) entry.href = el.href;

    interactive.push(entry);
  });

  // Grab visible text content (chunked, LLM-friendly)
  const bodyText = document.body?.innerText?.trim().slice(0, 3000) || '';

  return {
    url: window.location.href,
    title: document.title,
    bodyText,
    interactive: interactive.slice(0, 50), // cap at 50 elements
  };
}

function performClick(selector) {
  const el = document.querySelector(selector);
  if (!el) return { error: `Element not found: ${selector}` };
  el.click();
  return { ok: true, clicked: selector };
}

function performFill(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return { error: `Element not found: ${selector}` };
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, filled: selector, value };
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 &&
    window.getComputedStyle(el).visibility !== 'hidden' &&
    window.getComputedStyle(el).display !== 'none';
}

function generateSelector(el, index) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.name) return `[name="${CSS.escape(el.name)}"]`;
  if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
  // Fallback: positional
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
    if (siblings.length === 1) return `${generateSelector(parent, index)} > ${tag}`;
    const pos = siblings.indexOf(el) + 1;
    return `${generateSelector(parent, index)} > ${tag}:nth-child(${pos})`;
  }
  return `${tag}:nth-of-type(${index + 1})`;
}

console.log('[Webfuse WebMCP Demo] Content script loaded on', window.location.hostname);
