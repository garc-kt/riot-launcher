import './theming';
import './api';
import './polyfills';
import './super-potato';
import './load-hooks';
import './loader';
import { themeEngine } from './theming';
import { version } from '../../package.json';

if (window.Pengu) {
  window.Pengu.version = version;
  Object.freeze(window.Pengu);
}

(window as any).Companion = window.Pengu;
(window as any).CompanionTheme = themeEngine;