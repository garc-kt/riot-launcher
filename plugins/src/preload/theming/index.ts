// Native theming engine installed before client scripts run
import { extractSpecialRules } from '@riot/contracts/theming';
import { native } from '../api/native.ts';

let globalSheet: CSSStyleSheet;
try {
  globalSheet = new CSSStyleSheet();
} catch {
  // Fallback if constructable stylesheets are not supported
  globalSheet = {
    replaceSync: () => {},
    replace: () => Promise.resolve({} as any),
  } as unknown as CSSStyleSheet;
}

let activeThemeCss = '';
let extractedStyleEl: HTMLStyleElement | null = null;
const iframeStyles = new WeakMap<HTMLIFrameElement, HTMLStyleElement>();

function ensureHeadStyle(): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null;
  if (!extractedStyleEl) {
    extractedStyleEl = document.querySelector('#companion-theme-extracted');
    if (!extractedStyleEl && (document.head || document.documentElement)) {
      extractedStyleEl = document.createElement('style');
      extractedStyleEl.id = 'companion-theme-extracted';
      const container = document.head || document.documentElement;
      container.appendChild(extractedStyleEl);
    }
  }
  return extractedStyleEl;
}

function syncIframe(iframe: HTMLIFrameElement) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    let style = iframeStyles.get(iframe);
    if (!style || !doc.contains(style)) {
      style = doc.createElement('style');
      style.className = 'companion-iframe-theme';
      (doc.head || doc.documentElement)?.appendChild(style);
      iframeStyles.set(iframe, style);
    }
    style.textContent = activeThemeCss;
  } catch {
    // Cross-origin iframe or not yet ready
  }
}

function observeIframes() {
  if (typeof document === 'undefined') return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLIFrameElement) {
          node.addEventListener('load', () => syncIframe(node));
          syncIframe(node);
        } else if (node instanceof HTMLElement) {
          const iframes = node.querySelectorAll('iframe');
          iframes.forEach((iframe) => {
            iframe.addEventListener('load', () => syncIframe(iframe));
            syncIframe(iframe);
          });
        }
      }
    }
  });

  const target = document.documentElement || document;
  observer.observe(target, { childList: true, subtree: true });

  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.documentElement && target !== document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    });
  }
}

export function applyTheme(css: string) {
  activeThemeCss = css || '';

  const { cleanedCss, specialCss } = extractSpecialRules(activeThemeCss);

  // Update constructable stylesheet
  if (globalSheet && typeof globalSheet.replaceSync === 'function') {
    try {
      globalSheet.replaceSync(cleanedCss);
    } catch (err) {
      console.warn('Failed to replace constructable stylesheet rules:', err);
    }
  }

  // Update extracted @import and @font-face
  const styleEl = ensureHeadStyle();
  if (styleEl) {
    styleEl.textContent = specialCss;
  } else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const el = ensureHeadStyle();
      if (el) el.textContent = specialCss;
    });
  }

  // Sync any existing iframes
  if (typeof document !== 'undefined') {
    document.querySelectorAll('iframe').forEach(syncIframe);
  }
}

export function clearTheme() {
  applyTheme('');
}

export function getActiveTheme(): string {
  return activeThemeCss;
}

// Adopt the global sheet into the top-level document. The preset themes
// target light-DOM client chrome (`body`, `.rcp-fe-lol-navigation-bar`,
// `.rcp-fe-viewport-root`) — RCP plugin UI is Ember-rendered into the main
// document, not shadow DOM, so without this the shadow-root patch below
// never actually reaches any of the selectors a theme is meant to style.
function adoptIntoDocument() {
  if (typeof document === 'undefined' || !('adoptedStyleSheets' in document)) return;
  try {
    if (!document.adoptedStyleSheets.includes(globalSheet)) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, globalSheet];
    }
  } catch (e) {
    console.warn('Failed to adopt global theme stylesheet into document:', e);
  }
}

// Install shadow DOM patch before any shadow roots are created
export function installNativeTheming() {
  adoptIntoDocument();

  if (typeof Element === 'undefined' || !Element.prototype.attachShadow) return;

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const root = originalAttachShadow.call(this, init);
    try {
      // The companion's own root opts out by default (its `data-companion-root`
      // marker, set before attachShadow is called) — a user theme restyling a
      // third-party plugin is the point of this patch, but silently bleeding
      // into the first-party HUD's own deliberately minimal chrome is not.
      // `data-theme-target` opts a specific host back in.
      const el = this as Element;
      const optedOut = el.hasAttribute?.('data-companion-root') && !el.hasAttribute?.('data-theme-target');
      if (!optedOut && globalSheet && root.adoptedStyleSheets && !root.adoptedStyleSheets.includes(globalSheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, globalSheet];
      }
    } catch (e) {
      console.warn('Failed to adopt global theme stylesheet on shadow root:', e);
    }
    return root;
  };

  observeIframes();
}

// Read the last-saved theme directly off the native bridge (not
// window.DataStore, which isn't installed yet at this point in the preload
// import order) so a saved theme is live before the client's own first
// paint, matching the "constructable stylesheet, no FOUC" design goal.
function loadSavedThemeCss(): string {
  try {
    const raw = native.LoadDataStore?.();
    if (!raw) return '';
    const obj = JSON.parse(raw);
    return typeof obj?.companion_active_theme_css === 'string' ? obj.companion_active_theme_css : '';
  } catch {
    return '';
  }
}

// Auto-install immediately on module import
installNativeTheming();
applyTheme(loadSavedThemeCss());

export const themeEngine = {
  apply: applyTheme,
  clear: clearTheme,
  getActive: getActiveTheme,
};
