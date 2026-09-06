import { isPreloadExtDisabled } from './safety.ts';

export interface EmberRule {
  name: string;
  type?: 'component' | 'service';
  matcher: string | RegExp | ((args: any[]) => boolean);
  componentName?: string;
  mixin?: (Ember: any, extendArgs: any[]) => any;
  wraps?: Array<{ name: string; replacement: (caller: (...args: any[]) => any, args: any[]) => any }>;
  hookMethods?: Array<{ name: string; callback: (Ember: any, original: (...args: any[]) => any, ...args: any[]) => any }>;
  hookMethod?: { name: string; callback: (Ember: any, original: (...args: any[]) => any, ...args: any[]) => any };
  enabled?: boolean;
}

export interface EmberHookApi {
  registerRule(rule: EmberRule): () => void;
  getRulesCount(): number;
  isInstalled(): boolean;
  install(context?: any): void;
}

export class EmberHookManager implements EmberHookApi {
  private _rules: EmberRule[] = [];
  private _installed = false;
  private _wrappedMark = Symbol('RiotEmberWrapped');
  private _appliedRulesKey = '__riotAppliedRules';
  private _retroKey = '__riot_retro_applied';

  public isInstalled(): boolean {
    return this._installed;
  }

  public getRulesCount(): number {
    return this._rules.length;
  }

  public registerRule(rule: EmberRule): () => void {
    if (isPreloadExtDisabled()) {
      return () => {};
    }

    if (rule.enabled === undefined) rule.enabled = true;
    const i = this._rules.findIndex((r) => r.name === rule.name);
    if (i >= 0) {
      this._rules[i] = rule;
    } else {
      this._rules.push(rule);
    }

    return () => {
      const idx = this._rules.indexOf(rule);
      if (idx >= 0) this._rules.splice(idx, 1);
    };
  }

  public install(context?: any): void {
    if (this._installed) return;
    if (isPreloadExtDisabled()) {
      console.info('[EmberHook] Disabled via no_preload_ext flag');
      return;
    }

    try {
      const rcpInstance = context?.rcp || (typeof window !== 'undefined' ? (window as any).rcp : null);
      if (rcpInstance && typeof rcpInstance.postInit === 'function') {
        const registered = rcpInstance.postInit('rcp-fe-ember-libs', (api: any) => {
          try {
            const emberLibs = api;
            if (!emberLibs || typeof emberLibs.getEmber !== 'function') {
              console.warn('[EmberHook] rcp-fe-ember-libs has no getEmber');
              return;
            }

            const hookEmber = (Ember: any) => {
              if (!Ember || !Ember.Component) return;
              if (!emberLibs[this._wrappedMark]) {
                try {
                  this._hookComponentExtend(Ember);
                  this._hookServiceExtend(Ember);
                  console.info('[EmberHook] hooks installed');
                } catch (e) {
                  console.warn('[EmberHook] hook error:', e);
                }
                emberLibs[this._wrappedMark] = true;
              }
            };

            // Sync path: catches eagerly-loaded component extends
            const Ember = this._findEmberSync(emberLibs);
            if (Ember) {
              hookEmber(Ember);
            }

            // Async fallback: catches lazily-loaded components
            Promise.resolve(emberLibs.getEmber())
              .then((E) => hookEmber(E))
              .catch((err) => console.warn('[EmberHook] getEmber rejected:', err));
          } catch (err) {
            console.warn('[EmberHook] postInit callback threw:', err);
          }
        }, true);
        if (registered !== false) {
          this._installed = true;
        }
      }
    } catch (e) {
      console.warn('[EmberHook] install failed:', e);
    }
  }

  private _findEmberSync(emberLibs: any): any {
    try {
      if (typeof window !== 'undefined' && (window as any).Ember &&
          typeof (window as any).Ember.Component?.extend === 'function' &&
          typeof (window as any).Ember.Service?.extend === 'function') {
        return (window as any).Ember;
      }

      for (const key of Object.getOwnPropertyNames(emberLibs)) {
        const val = emberLibs[key];
        if (val && val !== emberLibs.getEmber &&
            typeof val.Component?.extend === 'function' &&
            typeof val.Service?.extend === 'function') {
          return val;
        }
      }

      if (typeof window !== 'undefined') {
        const wpr = (window as any).__webpack_require__;
        if (wpr?.c) {
          for (const id in wpr.c) {
            const mod = wpr.c[id];
            if (mod?.exports &&
                typeof mod.exports.Component?.extend === 'function' &&
                typeof mod.exports.Service?.extend === 'function') {
              return mod.exports;
            }
          }
        }
      }
    } catch {}
    return null;
  }

  private _extractClassNames(args: any[]): string[] {
    const collected: string[] = [];
    for (const a of args) {
      if (a && typeof a === 'object') {
        const cn = a.classNames;
        if (Array.isArray(cn)) {
          for (const c of cn) {
            if (typeof c === 'string') collected.push(c);
          }
        }
      }
    }
    return collected;
  }

  private _wrapInitWithNameCheck(initFn: Function, componentName: string) {
    return function (this: any, ...args: any[]) {
      const debugKey = this._debugContainerKey;
      let matchName: string | null = null;
      if (debugKey && typeof debugKey === 'string') {
        const afterColon = debugKey.split(':')[1];
        if (afterColon) matchName = afterColon.split('@')[0];
      }
      if (matchName && matchName !== componentName) {
        if (typeof this._super === 'function') {
          return this._super(...args);
        }
        return;
      }
      return initFn.apply(this, args);
    };
  }

  private _wrapMethod(target: any, name: string, replacement: Function): boolean {
    const fn = target[name];
    if (typeof fn !== 'function') return false;

    if (!Object.prototype.hasOwnProperty.call(target, this._wrappedMark)) {
      target[this._wrappedMark] = new Set<string>();
    }
    const wrappedSet: Set<string> = target[this._wrappedMark];
    if (wrappedSet.has(name)) return false;

    const original = fn;
    target[name] = function (this: any, ...args: any[]) {
      const caller = (...callArgs: any[]) => original.apply(this, callArgs);
      try {
        return replacement.call(this, caller, args);
      } catch (err) {
        console.warn(`[EmberHook] wrapped method ${name} threw:`, err);
        return caller(...args);
      }
    };

    wrappedSet.add(name);
    return true;
  }

  private _applyRuleToClass(Ember: any, klass: any, extendArgs: any[], rule: EmberRule): any {
    let cur = klass;

    if (rule.mixin) {
      try {
        let mixinObj = rule.mixin(Ember, extendArgs);
        if (rule.componentName && mixinObj && mixinObj.init) {
          mixinObj.init = this._wrapInitWithNameCheck(mixinObj.init, rule.componentName);
        }
        cur = cur.extend(mixinObj);
      } catch (e) {
        console.warn('[EmberHook] mixin failed:', rule.name, e);
      }
    }

    if (rule.wraps && rule.wraps.length > 0) {
      try {
        const proto = typeof cur.proto === 'function' ? cur.proto() : cur.prototype;
        if (proto) {
          if (!Object.prototype.hasOwnProperty.call(proto, this._appliedRulesKey)) {
            proto[this._appliedRulesKey] = new Set<string>();
          }
          const applied: Set<string> = proto[this._appliedRulesKey];
          if (!applied.has(rule.name)) {
            for (const w of rule.wraps) {
              this._wrapMethod(proto, w.name, w.replacement);
            }
            applied.add(rule.name);
          }
        }
      } catch (e) {
        console.warn('[EmberHook] wraps failed:', rule.name, e);
      }
    }

    const hookList = rule.hookMethods || (rule.hookMethod ? [rule.hookMethod] : []);
    if (hookList.length > 0) {
      try {
        const proto = typeof cur.proto === 'function' ? cur.proto() : cur.prototype;
        if (proto) {
          if (!Object.prototype.hasOwnProperty.call(proto, this._appliedRulesKey)) {
            proto[this._appliedRulesKey] = new Set<string>();
          }
          const applied: Set<string> = proto[this._appliedRulesKey];
          if (!applied.has(rule.name)) {
            for (const hm of hookList) {
              const original = proto[hm.name];
              proto[hm.name] = function (this: any, ...args: any[]) {
                const proxyOriginal = (...callArgs: any[]) => {
                  if (typeof original === 'function') {
                    return original.apply(this, callArgs);
                  }
                };
                try {
                  return hm.callback.call(this, Ember, proxyOriginal, ...args);
                } catch (err) {
                  console.warn(`[EmberHook] hookMethod ${hm.name} threw:`, err);
                  return proxyOriginal(...args);
                }
              };
            }
            applied.add(rule.name);
          }
        }
      } catch (e) {
        console.warn('[EmberHook] hookMethods failed:', rule.name, e);
      }
    }

    return cur;
  }

  private _hookComponentExtend(Ember: any) {
    const Component = Ember.Component;
    if (!Component || typeof Component.extend !== 'function') {
      console.warn('[EmberHook] Ember.Component.extend not found');
      return;
    }

    if (Component[this._wrappedMark]) return;

    const originalExtend = Component.extend.bind(Component);
    const self = this;

    Component.extend = function (...args: any[]) {
      let klass: any;
      try {
        klass = originalExtend(...args);
      } catch (err) {
        console.error('[EmberHook] original Component.extend threw:', err);
        throw err;
      }

      if (self._rules.length > 0) {
        for (const rule of self._rules) {
          if (rule.type === 'service' || rule.enabled === false) continue;
          try {
            const m = rule.matcher;
            let matched = false;

            if (typeof m === 'function') {
              matched = Boolean(m(args));
            } else if (m === '*') {
              matched = true;
            } else {
              const classNames = self._extractClassNames(args);
              if (m instanceof RegExp) {
                matched = classNames.some((c) => m.test(c));
              } else {
                matched = classNames.includes(m);
              }
            }

            if (matched) {
              klass = self._applyRuleToClass(Ember, klass, args, rule);
            }
          } catch (e) {
            console.warn(`[EmberHook] error evaluating rule "${rule.name}":`, e);
          }
        }
        if (klass) klass[self._retroKey] = true;
      }

      return klass;
    };

    Component[this._wrappedMark] = true;
  }

  private _hookServiceExtend(Ember: any) {
    const Service = Ember.Service;
    if (!Service || typeof Service.extend !== 'function') return;

    if (Service[this._wrappedMark]) return;

    const originalExtend = Service.extend.bind(Service);
    const self = this;

    Service.extend = function (...args: any[]) {
      let klass: any;
      try {
        klass = originalExtend(...args);
      } catch (err) {
        console.error('[EmberHook] original Service.extend threw:', err);
        throw err;
      }

      if (self._rules.length > 0) {
        for (const rule of self._rules) {
          if (rule.type !== 'service' || rule.enabled === false) continue;
          try {
            const m = rule.matcher;
            let matched = false;

            if (typeof m === 'function') {
              matched = Boolean(m(args));
            } else if (m === '*') {
              matched = true;
            } else {
              const classNames = self._extractClassNames(args);
              if (m instanceof RegExp) {
                matched = classNames.some((c) => m.test(c));
              } else {
                matched = classNames.includes(m);
              }
            }

            if (matched) {
              klass = self._applyRuleToClass(Ember, klass, args, rule);
            }
          } catch (e) {
            console.warn(`[EmberHook] error evaluating service rule "${rule.name}":`, e);
          }
        }
        if (klass) klass[self._retroKey] = true;
      }

      return klass;
    };

    Service[this._wrappedMark] = true;
  }
}

export const emberHook: EmberHookApi =
  (typeof window !== 'undefined' && (window as any).__riotEmberHook) ||
  new EmberHookManager();

if (typeof window !== 'undefined') {
  (window as any).__riotEmberHook = emberHook;
}
