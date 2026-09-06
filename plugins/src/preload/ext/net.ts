import { isPreloadExtDisabled } from './safety.ts';

export type Pattern = string | RegExp;

export interface NetFetchHookApi {
  hookReq(pattern: Pattern, callback: (input: RequestInfo | URL, init?: RequestInit) => void): () => void;
  hookRes(pattern: Pattern, callback: (text: string) => string | void): () => void;
}

export interface NetXhrHookApi {
  hookReq(pattern: Pattern, callback: (method: string, url: string, xhr: XMLHttpRequest, body: any) => any): () => void;
  hookRes(pattern: Pattern, callback: (method: string, url: string, xhr: XMLHttpRequest, text: string) => string | void): () => void;
}

export interface NetWsHookApi {
  hook(pattern: Pattern, callback: (endpoint: string, payload: any) => any): () => void;
  install(socketContext?: any): void;
}

export interface NetHookApi {
  fetch: NetFetchHookApi;
  xhr: NetXhrHookApi;
  ws: NetWsHookApi;
  hookFetchReq(pattern: Pattern, callback: (input: RequestInfo | URL, init?: RequestInit) => void): () => void;
  hookFetchRes(pattern: Pattern, callback: (text: string) => string | void): () => void;
  hookXhrReq(pattern: Pattern, callback: (method: string, url: string, xhr: XMLHttpRequest, body: any) => any): () => void;
  hookXhrRes(pattern: Pattern, callback: (method: string, url: string, xhr: XMLHttpRequest, text: string) => string | void): () => void;
  hookWs(pattern: Pattern, callback: (endpoint: string, payload: any) => any): () => void;
  install(context?: any): void;
  uninstall(): void;
  isInstalled(): boolean;
}

export class NetHookManager implements NetHookApi {
  private _fetchInstalled = false;
  private _xhrInstalled = false;
  private _wsInstalled = false;

  private _originalFetch: typeof window.fetch | null = null;
  private _originalOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private _originalPublish: ((endpoint: string, payload: any) => any) | null = null;
  private _dispatcherRef: any = null;

  private _fetchReqHooks = new Map<Pattern, Array<(input: RequestInfo | URL, init?: RequestInit) => void>>();
  private _fetchResHooks = new Map<Pattern, Array<(text: string) => string | void>>();

  private _xhrReqHooks = new Map<Pattern, Array<(method: string, url: string, xhr: XMLHttpRequest, body: any) => any>>();
  private _xhrResHooks = new Map<Pattern, Array<(method: string, url: string, xhr: XMLHttpRequest, text: string) => string | void>>();

  private _wsHooks = new Map<Pattern, Array<(endpoint: string, payload: any) => any>>();

  public fetch: NetFetchHookApi = {
    hookReq: (pattern, cb) => this.hookFetchReq(pattern, cb),
    hookRes: (pattern, cb) => this.hookFetchRes(pattern, cb),
  };

  public xhr: NetXhrHookApi = {
    hookReq: (pattern, cb) => this.hookXhrReq(pattern, cb),
    hookRes: (pattern, cb) => this.hookXhrRes(pattern, cb),
  };

  public ws: NetWsHookApi = {
    hook: (pattern, cb) => this.hookWs(pattern, cb),
    install: (ctx) => this.installWs(ctx),
  };

  public isInstalled(): boolean {
    return this._fetchInstalled || this._xhrInstalled || this._wsInstalled;
  }

  public uninstall(): void {
    if (this._fetchInstalled && this._originalFetch && typeof window !== 'undefined') {
      window.fetch = this._originalFetch;
      this._originalFetch = null;
      this._fetchInstalled = false;
    }
    if (this._xhrInstalled && this._originalOpen && typeof XMLHttpRequest !== 'undefined') {
      XMLHttpRequest.prototype.open = this._originalOpen;
      this._originalOpen = null;
      this._xhrInstalled = false;
    }
    if (this._wsInstalled && this._dispatcherRef && this._originalPublish) {
      this._dispatcherRef.publish = this._originalPublish;
      this._originalPublish = null;
      this._dispatcherRef = null;
      this._wsInstalled = false;
    }
    this._fetchReqHooks.clear();
    this._fetchResHooks.clear();
    this._xhrReqHooks.clear();
    this._xhrResHooks.clear();
    this._wsHooks.clear();
  }

  public install(context?: any): void {
    if (isPreloadExtDisabled()) {
      console.info('[NetHook] Disabled via no_preload_ext flag');
      return;
    }
    this.installFetch();
    this.installXhr();
    try {
      const rcpInstance = context?.rcp || (typeof window !== 'undefined' ? (window as any).rcp : null);
      if (rcpInstance && typeof rcpInstance.preInit === 'function') {
        rcpInstance.preInit('rcp-fe-common-libs', (provider: any) => {
          this.installWs(provider?.context);
        });
      }
      if (context?.socket) {
        this.installWs(context);
      }
    } catch {}
  }

  private installFetch(): void {
    if (this._fetchInstalled) return;
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

    this._fetchInstalled = true;
    this._originalFetch = window.fetch;
    const originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      let currentInput = input;
      let currentInit = init;
      const urlStr = input instanceof Request ? input.url : String(input);

      if (self._fetchReqHooks.size > 0) {
        for (const [pattern, callbacks] of self._fetchReqHooks.entries()) {
          try {
            const matched = pattern instanceof RegExp ? pattern.test(urlStr) : urlStr.includes(pattern);
            if (matched) {
              for (const cb of callbacks) {
                try {
                  cb(currentInput, currentInit);
                } catch (cbErr) {
                  console.warn('[NetHook:fetch] req callback threw:', cbErr);
                }
              }
            }
          } catch (mErr) {
            console.warn('[NetHook:fetch] req matcher threw:', mErr);
          }
        }
      }

      const response = await originalFetch(currentInput, currentInit);

      let hooksToRun: Array<(text: string) => string | void> = [];
      if (self._fetchResHooks.size > 0) {
        for (const [pattern, callbacks] of self._fetchResHooks.entries()) {
          try {
            const matched = pattern instanceof RegExp ? pattern.test(urlStr) : urlStr.includes(pattern);
            if (matched) {
              hooksToRun.push(...callbacks);
            }
          } catch (mErr) {
            console.warn('[NetHook:fetch] res matcher threw:', mErr);
          }
        }
      }

      if (hooksToRun.length > 0) {
        let cachedPromise: Promise<string> | null = null;
        const originalText = response.text.bind(response);
        response.text = () => {
          if (!cachedPromise) {
            cachedPromise = (async () => {
              let text = await originalText();
              for (const cb of hooksToRun) {
                try {
                  const res = cb(text);
                  if (typeof res === 'string') text = res;
                } catch (cbErr) {
                  console.warn('[NetHook:fetch] res callback threw:', cbErr);
                }
              }
              return text;
            })();
          }
          return cachedPromise;
        };

        response.json = async () => {
          const text = await response.text();
          return JSON.parse(text);
        };
      }

      return response;
    };
  }

  private installXhr(): void {
    if (this._xhrInstalled) return;
    if (typeof XMLHttpRequest === 'undefined' || !XMLHttpRequest.prototype?.open) return;

    this._xhrInstalled = true;
    this._originalOpen = XMLHttpRequest.prototype.open;
    const originalOpen = XMLHttpRequest.prototype.open;
    const self = this;

    XMLHttpRequest.prototype.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
      const urlStr = url.toString();
      this.__urlStr = urlStr;
      this.__method = method;

      let matchedPre: Array<(method: string, url: string, xhr: XMLHttpRequest, body: any) => any> = [];
      let matchedPost: Array<(method: string, url: string, xhr: XMLHttpRequest, text: string) => string | void> = [];

      for (const [pattern, callbacks] of self._xhrReqHooks.entries()) {
        try {
          if (pattern instanceof RegExp ? pattern.test(urlStr) : urlStr.includes(pattern)) {
            matchedPre.push(...callbacks);
          }
        } catch {}
      }

      for (const [pattern, callbacks] of self._xhrResHooks.entries()) {
        try {
          if (pattern instanceof RegExp ? pattern.test(urlStr) : urlStr.includes(pattern)) {
            matchedPost.push(...callbacks);
          }
        } catch {}
      }

      if (matchedPre.length > 0 || matchedPost.length > 0) {
        const originalSend = this.send;
        this.send = function (this: any, body?: any) {
          let currentBody = body;
          for (const cb of matchedPre) {
            try {
              currentBody = cb(this.__method, this.__urlStr, this, currentBody) ?? currentBody;
            } catch (err) {
              console.warn('[NetHook:xhr] req callback threw:', err);
            }
          }

          if (matchedPost.length > 0) {
            const mutateResponse = () => {
              if (this.readyState === 4 && (this.responseType === '' || this.responseType === 'text')) {
                try {
                  let modifiedText = this.responseText;
                  for (const cb of matchedPost) {
                    try {
                      const res = cb(this.__method, this.__urlStr, this, modifiedText);
                      if (typeof res === 'string') modifiedText = res;
                    } catch (err) {
                      console.warn('[NetHook:xhr] res callback threw:', err);
                    }
                  }
                  if (modifiedText !== this.responseText) {
                    Object.defineProperty(this, 'responseText', {
                      writable: true,
                      configurable: true,
                      value: modifiedText,
                    });
                    if (this.responseType === '') {
                      Object.defineProperty(this, 'response', {
                        writable: true,
                        configurable: true,
                        value: modifiedText,
                      });
                    }
                  }
                } catch (e) {
                  console.warn('[NetHook:xhr] failed to mutate response:', e);
                }
              }
            };

            const originalOnReadyStateChange = this.onreadystatechange;
            this.onreadystatechange = function (this: any, ev: Event) {
              mutateResponse();
              if (originalOnReadyStateChange) {
                return originalOnReadyStateChange.call(this, ev);
              }
            };

            try {
              this.addEventListener('readystatechange', () => mutateResponse());
              this.addEventListener('load', () => mutateResponse());
            } catch {}
          }

          return originalSend.call(this, currentBody);
        };
      }

      return (originalOpen as any).apply(this, [method, urlStr, ...rest]);
    };
  }

  public installWs(socketContext?: any): void {
    if (this._wsInstalled) return;
    if (isPreloadExtDisabled()) return;

    const dispatcher =
      socketContext?.socket?._dispatcher ||
      (typeof window !== 'undefined' && (window as any).__companion_context?.socket?._dispatcher) ||
      (typeof window !== 'undefined' && (window as any).rcp?.get?.('rcp-fe-common-libs')?.socket?._dispatcher);

    if (!dispatcher || typeof dispatcher.publish !== 'function') return;

    this._wsInstalled = true;
    this._dispatcherRef = dispatcher;
    this._originalPublish = dispatcher.publish;
    const originalPublish = dispatcher.publish.bind(dispatcher);
    const self = this;

    dispatcher.publish = function (endpoint: string, payload: any) {
      let currentPayload = payload;

      for (const [pattern, callbacks] of self._wsHooks.entries()) {
        try {
          const matched = pattern instanceof RegExp ? pattern.test(endpoint) : endpoint.includes(pattern);
          if (matched) {
            for (const cb of callbacks) {
              try {
                currentPayload = cb(endpoint, currentPayload) ?? currentPayload;
              } catch (err) {
                console.warn('[NetHook:ws] callback threw:', err);
              }
            }
          }
        } catch {}
      }

      if (currentPayload !== null && currentPayload !== undefined) {
        return originalPublish(endpoint, currentPayload);
      }
    };
  }

  public hookFetchReq(pattern: Pattern, callback: (input: RequestInfo | URL, init?: RequestInit) => void): () => void {
    if (isPreloadExtDisabled()) return () => {};
    this.installFetch();
    if (!this._fetchReqHooks.has(pattern)) this._fetchReqHooks.set(pattern, []);
    this._fetchReqHooks.get(pattern)!.push(callback);
    return () => {
      const arr = this._fetchReqHooks.get(pattern);
      if (!arr) return;
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) this._fetchReqHooks.delete(pattern);
    };
  }

  public hookFetchRes(pattern: Pattern, callback: (text: string) => string | void): () => void {
    if (isPreloadExtDisabled()) return () => {};
    this.installFetch();
    if (!this._fetchResHooks.has(pattern)) this._fetchResHooks.set(pattern, []);
    this._fetchResHooks.get(pattern)!.push(callback);
    return () => {
      const arr = this._fetchResHooks.get(pattern);
      if (!arr) return;
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) this._fetchResHooks.delete(pattern);
    };
  }

  public hookXhrReq(pattern: Pattern, callback: (method: string, url: string, xhr: XMLHttpRequest, body: any) => any): () => void {
    if (isPreloadExtDisabled()) return () => {};
    this.installXhr();
    if (!this._xhrReqHooks.has(pattern)) this._xhrReqHooks.set(pattern, []);
    this._xhrReqHooks.get(pattern)!.push(callback);
    return () => {
      const arr = this._xhrReqHooks.get(pattern);
      if (!arr) return;
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) this._xhrReqHooks.delete(pattern);
    };
  }

  public hookXhrRes(pattern: Pattern, callback: (method: string, url: string, xhr: XMLHttpRequest, text: string) => string | void): () => void {
    if (isPreloadExtDisabled()) return () => {};
    this.installXhr();
    if (!this._xhrResHooks.has(pattern)) this._xhrResHooks.set(pattern, []);
    this._xhrResHooks.get(pattern)!.push(callback);
    return () => {
      const arr = this._xhrResHooks.get(pattern);
      if (!arr) return;
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) this._xhrResHooks.delete(pattern);
    };
  }

  public hookWs(pattern: Pattern, callback: (endpoint: string, payload: any) => any): () => void {
    if (isPreloadExtDisabled()) return () => {};
    this.installWs();
    if (!this._wsHooks.has(pattern)) this._wsHooks.set(pattern, []);
    this._wsHooks.get(pattern)!.push(callback);
    return () => {
      const arr = this._wsHooks.get(pattern);
      if (!arr) return;
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) this._wsHooks.delete(pattern);
    };
  }
}

export const netHook: NetHookApi =
  (typeof window !== 'undefined' && (window as any).__riotNetHook) ||
  new NetHookManager();

if (typeof window !== 'undefined') {
  (window as any).__riotNetHook = netHook;
}
