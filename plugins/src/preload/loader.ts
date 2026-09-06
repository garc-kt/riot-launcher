import { rcp, socket } from './rcp';
import { createPluginExtensions } from './ext';

const plugins = window.Pengu.plugins

if ('disabledPlugins' in window.Pengu) {
  const blacklist = new Set<number>
  const disabled = String(window.Pengu.disabledPlugins)
  delete window.Pengu.disabledPlugins

  for (const hash of disabled.split(',')) {
    const num = window.parseInt(hash, 16)
    blacklist.add(num)
  }

  function getHash(str: string) {
    const data = new TextEncoder().encode(str)
    let hash = 0x811c9dc5

    for (const byte of data) {
      hash ^= byte
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }

    return hash >>> 0
  }

  function isDisabled(path: string) {
    path = path.toLowerCase().replace(/\\/g, '/')
    return blacklist.has(getHash(path))
  }

  for (let i = plugins.length - 1; i >= 0; --i) {
    const entry = plugins[i]
    // @default/ is the built-in SolidJS views bundle (loaded separately,
    // see views/index.tsx). @companion/ is the first-party companion app —
    // excluded here so it can never be hash-disabled from the plugin
    // gallery like a third-party plugin; it's loaded unconditionally below.
    if (isDisabled(entry) || /^@default\//i.test(entry) || /^@companion\//i.test(entry)) {
      plugins.splice(i, 1)
    }
  }
}

async function loadPlugin(entry: string) {
  let stage = 'load';
  try {
    // Acquire plugin
    const url = `https://plugins/${entry}`;
    const plugin: Plugin = await import(url);

    // Init immediately
    if (typeof plugin.init === 'function') {
      stage = 'initialize';
      const slashIndex = entry.indexOf('/');
      const isDir = slashIndex !== -1;
      const pluginName = isDir ? entry.substring(0, slashIndex) : '';
      const extName = isDir ? entry.substring(0, entry.lastIndexOf('/')) : entry.replace(/\.js$/, '');

      const initContext: any = {
        rcp,
        socket,
        ext: createPluginExtensions(extName || 'default'),
      };
      // If it's not top-level JS (upstream contract)
      if (pluginName) {
        const meta = { name: pluginName };
        initContext['meta'] = meta;
      }
      await plugin.init(initContext);
    }

    // Register load
    if (typeof plugin.load === 'function') {
      window.addEventListener('load', plugin.load);
    } else if (typeof plugin.default === 'function') {
      window.addEventListener('load', plugin.default);
    }

    const msg = `Loaded plugin "${entry}".`;
    console.info('%c Pengu ', 'background: #183461; color: #fff', msg);
  } catch (err) {
    const msg = `Failed to ${stage} plugin "${entry}".\n`;
    console.error('%c Pengu ', 'background: #183461; color: #fff', msg, err);
  }
}

// Load all user plugins, plus the first-party companion app. The companion
// is loaded directly rather than through the user plugin list above — it
// isn't something a user should be able to disable by hash collision the
// way third-party plugins can, and it ships at a fixed, reserved path.
const waitable = Promise.all([
  ...plugins.map(loadPlugin),
  loadPlugin('@companion/index.js'),
]);

// Listen for the first rcp, it's also the first listener
rcp.preInit('rcp-fe-common-libs', async function () {
  // Wait for plugins load
  await waitable;
});

export { }