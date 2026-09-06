import './theming';
import './api';
import './polyfills';
import './super-potato';
import './load-hooks';
import { rcp } from './rcp';
import { emberHook, netHook } from './ext';

// Install preload extensions (Ember and Net hooks) before user plugins initialize
try {
  emberHook.install({ rcp });
  netHook.install({ rcp });
} catch (err) {
  console.warn('[Preload] Failed to install preload extensions:', err);
}

import './loader';
import { themeEngine } from './theming';

if (window.Pengu) {
  window.Pengu.version = __APP_VERSION__;
  Object.freeze(window.Pengu);
}

(window as any).Companion = window.Pengu;
(window as any).CompanionTheme = themeEngine;