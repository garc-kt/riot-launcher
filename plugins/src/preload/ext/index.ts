import { themeEngine } from '../theming/index.ts';
import { native } from '../api/native.ts';

export interface ScopedStore {
  get<T = any>(key: string, defaultValue?: T): T | undefined;
  set<T = any>(key: string, value: T): boolean;
  delete(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  entries(): [string, any][];
}

export interface ScopedFs {
  readText(relativePath: string): Promise<string>;
  writeText(relativePath: string, content: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  list(relativeDir?: string): Promise<string[]>;
}

export interface CommandDefinition {
  id: string;
  name: string | (() => string);
  legend?: string | (() => string);
  tags?: string[];
  icon?: string;
  group?: string | (() => string);
  hidden?: boolean;
  perform?: (id?: string) => any;
}

export interface CommandRegistry {
  register(cmd: CommandDefinition): () => void;
  list(): CommandDefinition[];
  execute(id: string): any;
}

// In-memory command registry
const commandMap = new Map<string, CommandDefinition>();

export const commands: CommandRegistry = {
  register(cmd: CommandDefinition) {
    commandMap.set(cmd.id, cmd);
    if (typeof window !== 'undefined' && (window as any).CommandBar && typeof (window as any).CommandBar.addAction === 'function') {
      (window as any).CommandBar.addAction({
        id: cmd.id,
        name: cmd.name,
        legend: cmd.legend,
        tags: cmd.tags,
        icon: cmd.icon,
        group: cmd.group,
        hidden: cmd.hidden,
        perform: cmd.perform,
      });
    }
    return () => {
      commandMap.delete(cmd.id);
      if (typeof window !== 'undefined' && (window as any).CommandBar && typeof (window as any).CommandBar.removeAction === 'function') {
        (window as any).CommandBar.removeAction(cmd.id);
      }
    };
  },
  list() {
    return Array.from(commandMap.values());
  },
  execute(id: string) {
    const cmd = commandMap.get(id);
    if (cmd && typeof cmd.perform === 'function') {
      return cmd.perform(id);
    }
    console.warn(`Command "${id}" not found.`);
  },
};

// Create a scoped store per plugin with isolated storage & debounced commit
export function createScopedStore(pluginName: string): ScopedStore {
  let cache: Map<string, any> | null = null;
  let saveTimer: any = null;

  const initCache = (): Map<string, any> => {
    if (cache !== null) return cache;
    cache = new Map<string, any>();

    // 1. Try native LoadPluginStore
    if (typeof native !== 'undefined' && typeof native.LoadPluginStore === 'function') {
      try {
        const raw = native.LoadPluginStore(pluginName);
        if (raw) {
          const obj = JSON.parse(raw);
          for (const [k, v] of Object.entries(obj)) {
            cache.set(k, v);
          }
          return cache;
        }
      } catch (err) {
        console.warn(`Failed to parse scoped store for plugin ${pluginName}:`, err);
      }
    }

    // 2. Fallback: In-memory or prefixed global DataStore without re-serialize
    if (typeof window !== 'undefined' && window.DataStore) {
      const prefix = `plugin:${pluginName}:`;
      // Check if global DataStore already holds any keys for this plugin
      // We don't re-serialize global store here
    }

    return cache;
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!cache) return;
      const dataObj = Object.fromEntries(cache);
      const json = JSON.stringify(dataObj);

      if (typeof native !== 'undefined' && typeof native.SavePluginStore === 'function') {
        try {
          native.SavePluginStore(pluginName, json);
          return;
        } catch (err) {
          console.warn(`Failed to persist scoped store for ${pluginName}:`, err);
        }
      }

      // Secondary fallback
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`companion_store:${pluginName}`, json);
        } catch {}
      }
    }, 100);
  };

  return {
    get<T = any>(key: string, defaultValue?: T): T | undefined {
      const c = initCache();
      return c.has(key) ? (c.get(key) as T) : defaultValue;
    },
    set<T = any>(key: string, value: T): boolean {
      if (typeof key !== 'string') return false;
      const c = initCache();
      c.set(key, value);
      scheduleSave();
      return true;
    },
    delete(key: string): boolean {
      const c = initCache();
      const res = c.delete(key);
      if (res) scheduleSave();
      return res;
    },
    has(key: string): boolean {
      const c = initCache();
      return c.has(key);
    },
    clear() {
      const c = initCache();
      c.clear();
      scheduleSave();
    },
    entries(): [string, any][] {
      const c = initCache();
      return Array.from(c.entries());
    },
  };
}

// Create a scoped file system per plugin
export function createScopedFs(pluginName: string): ScopedFs {
  const sanitize = (relPath: string) => {
    return relPath.replace(/^(\.\.[\/\\])+/, '').replace(/^\/+/, '');
  };

  const virtualFs = new Map<string, string>();

  return {
    async readText(relativePath: string): Promise<string> {
      const clean = sanitize(relativePath);

      // 1. Try native ReadPluginFile
      if (typeof native !== 'undefined' && typeof native.ReadPluginFile === 'function') {
        const content = native.ReadPluginFile(pluginName, clean);
        if (content !== null && content !== undefined) {
          return content;
        }
      }

      // 2. Check virtual in-memory fallback
      if (virtualFs.has(clean)) {
        return virtualFs.get(clean)!;
      }

      // 3. Fallback to CEF scheme
      const url = `https://companion/${pluginName}/${clean}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to read file ${relativePath}: HTTP ${res.status}`);
      }
      return await res.text();
    },
    async writeText(relativePath: string, content: string): Promise<void> {
      const clean = sanitize(relativePath);
      virtualFs.set(clean, content);

      // Try native WritePluginFile
      if (typeof native !== 'undefined' && typeof native.WritePluginFile === 'function') {
        try {
          native.WritePluginFile(pluginName, clean, content);
          return;
        } catch (err) {
          console.warn(`Failed to write plugin file ${relativePath}:`, err);
        }
      }
    },
    async exists(relativePath: string): Promise<boolean> {
      const clean = sanitize(relativePath);
      if (virtualFs.has(clean)) return true;

      if (typeof native !== 'undefined' && typeof native.PluginFileExists === 'function') {
        return Boolean(native.PluginFileExists(pluginName, clean));
      }

      try {
        const url = `https://companion/${pluginName}/${clean}`;
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok;
      } catch {
        return false;
      }
    },
    async list(relativeDir = ''): Promise<string[]> {
      const cleanDir = sanitize(relativeDir);
      if (typeof native !== 'undefined' && typeof native.ListPluginFiles === 'function') {
        const files = native.ListPluginFiles(pluginName, cleanDir);
        if (Array.isArray(files)) return files;
      }
      return Array.from(virtualFs.keys()).filter((k) =>
        cleanDir ? k.startsWith(cleanDir + '/') : true
      );
    },
  };
}

export function createPluginExtensions(pluginName = 'anonymous') {
  return {
    store: createScopedStore(pluginName),
    fs: createScopedFs(pluginName),
    commands,
    theme: themeEngine,
  };
}
