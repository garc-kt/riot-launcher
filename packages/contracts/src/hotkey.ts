// Global hotkey matching for the companion HUD.
//
// Kept dependency-free (and out of the Vue layer) so the matching rules can be
// unit-tested directly — see tests/hotkey.test.mjs. The Vue binding that uses
// them lives in app/src/composables/useHotkey.ts.

/** Default key that toggles the companion window open/closed. */
export const COMPANION_TOGGLE_KEY = 'F1';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

interface HotkeyEventLike {
  key?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  target?: unknown;
  composedPath?: () => unknown[];
}

interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

/**
 * Resolve the element the key event actually landed on.
 *
 * The companion mounts inside a shadow root, so for anything focused within it
 * `event.target` is retargeted to the <companion-root> host and tells us
 * nothing about what the user is typing into. `composedPath()[0]` is the real
 * innermost target and works for both light and shadow DOM.
 */
function resolveTarget(event: HotkeyEventLike): TargetLike | null {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : undefined;
  const target = path && path.length > 0 ? path[0] : event.target;
  return target && typeof target === 'object' ? (target as TargetLike) : null;
}

/** True when the event landed in a text field, where hotkeys must not fire. */
export function isEditableTarget(event: HotkeyEventLike): boolean {
  const target = resolveTarget(event);
  if (!target) return false;
  if (target.isContentEditable === true) return true;
  return typeof target.tagName === 'string' && EDITABLE_TAGS.has(target.tagName.toUpperCase());
}

/**
 * True when `event` should trigger the bare hotkey `key`.
 *
 * Requires an exact match with no modifiers held, so this never steals a
 * client or loader chord (Ctrl+Shift+R, Ctrl+Shift+Enter, ...). Auto-repeat is
 * ignored so holding the key doesn't flap the panel open and shut.
 */
export function matchesHotkey(event: HotkeyEventLike, key: string): boolean {
  if (!event || event.key !== key) return false;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
  if (event.repeat) return false;
  return !isEditableTarget(event);
}
