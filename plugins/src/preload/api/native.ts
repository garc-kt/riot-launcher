// @ts-ignore
export const native: Native = typeof window !== 'undefined' ? window.__native : ({} as any);

if (typeof window !== 'undefined') {
  // @ts-ignore
  delete window.__native;
}

interface Native {
  OpenDevTools: () => void;
  OpenPluginsFolder: (path?: string) => boolean;
  ReloadClient: () => void;

  SetWindowTheme: (dark: boolean) => void;
  SetWindowVibrancy: (kind: number | null, state?: number) => void;

  LoadDataStore: () => string;
  SaveDataStore: (data: string) => void;

  LoadPluginStore?: (pluginName: string) => string;
  SavePluginStore?: (pluginName: string, data: string) => void;
  ReadPluginFile?: (pluginName: string, relPath: string) => string | null;
  WritePluginFile?: (pluginName: string, relPath: string, content: string) => boolean;
  PluginFileExists?: (pluginName: string, relPath: string) => boolean;
  ListPluginFiles?: (pluginName: string, relDir?: string) => string[];
}