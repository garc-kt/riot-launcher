// Native theming engine installed before client scripts run

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

// Extract @import and @font-face rules that misbehave inside constructable stylesheets in CEF
export function extractSpecialRules(css: string | null | undefined): { cleanedCss: string; specialCss: string } {
  if (!css || typeof css !== 'string') {
    return { cleanedCss: '', specialCss: '' };
  }

  const importRegex = /@import\s+(?:url\([^)]+\)|"[^"]+"|'[^']+'|[^;]+);/gi;
  const fontFaceRegex = /@font-face\s*\{[\s\S]*?\}/gi;

  const specialParts: string[] = [];

  const cleaned = css
    .replace(importRegex, (match) => {
      specialParts.push(match.trim());
      return '';
    })
    .replace(fontFaceRegex, (match) => {
      specialParts.push(match.trim());
      return '';
    });

  return {
    cleanedCss: cleaned.trim(),
    specialCss: specialParts.join('\n').trim(),
  };
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

// Install shadow DOM patch before any shadow roots are created
export function installNativeTheming() {
  if (typeof Element === 'undefined' || !Element.prototype.attachShadow) return;

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const root = originalAttachShadow.call(this, init);
    try {
      if (globalSheet && root.adoptedStyleSheets && !root.adoptedStyleSheets.includes(globalSheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, globalSheet];
      }
    } catch (e) {
      console.warn('Failed to adopt global theme stylesheet on shadow root:', e);
    }
    return root;
  };

  observeIframes();
}

// Auto-install immediately on module import
installNativeTheming();

export const themeEngine = {
  apply: applyTheme,
  clear: clearTheme,
  getActive: getActiveTheme,
};
