import path from 'node:path';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { build } from 'esbuild';

// Vite plugins
import mkcert from 'vite-plugin-mkcert';
import solidPlugin from 'vite-plugin-solid';
import bundleCssInJs from 'vite-plugin-css-injected-by-js';
import viteRestart from 'vite-plugin-restart';

const port = 3001;
const root = (...args: string[]) => path.join(__dirname, ...args);

// Single source of truth for the app version: the workspace root package.json.
// `window.Pengu.version` must match the loader/Cargo/tauri.conf version so the
// in-client updater compares against the version that actually ships.
const rootPkg = JSON.parse(readFileSync(root('..', 'package.json'), 'utf-8'));

export default defineConfig(({ command, mode }) => {

  const dev = command === 'serve'
    || mode === 'development';

  return {
    publicDir: false,
    resolve: {
      alias: {
        '@riot/contracts': root('..', 'packages', 'contracts', 'src'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(rootPkg.version)
    },
    server: {
      https: true,
      port: port
    },
    esbuild: {
      legalComments: 'none',
    },
    build: {
      assetsInlineLimit: 1024 * 64,
      minify: !dev,
      modulePreload: false,
      lib: {
        name: 'preload',
        entry: 'src/index.ts',
        formats: ['iife']
      },
      rollupOptions: {
        output: {
          format: 'iife',
          sourcemap: dev ? 'inline' : false,
          entryFileNames: 'preload.js'
        }
      }
    },
    plugins: [
      mkcert(),
      solidPlugin(),
      bundleCssInJs({
        topExecutionPriority: false,
        injectCodeFunction: function (css) {
          document.addEventListener('DOMContentLoaded', function () {
            const style = document.createElement('style');
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
          });
        }
      }),
      viteRestart({
        restart: 'src/preload/**/*.ts'
      }),
      {
        name: 'pengu-serve',
        apply: 'serve',
        enforce: 'post',
        transform(code, id) {
          if (/\.(ts|tsx)$/i.test(id)) return;
          return code.replace(/\/src\//g, `https://localhost:${port}/src/`)
        },
        async configResolved() {
          await build({
            entryPoints: [root('src/preload/index.ts')],
            outfile: root('dist/preload.js'),
            bundle: true,
            format: 'iife',
            sourcemap: 'inline',
            footer: {
              'js': generateDevLoader(port)
            }
          });
        },
      },
      {
        name: 'pengu-build',
        apply: 'build',
        enforce: 'post',
        async closeBundle() {
          const raw = await fs.readFile(root('dist/preload.js'), 'utf-8');
          const code = sealGlobalScope(raw);
          // Write the sealed bundle back so dist/preload.js and the bytes
          // embedded into core.dll are always the exact same script.
          await fs.writeFile(root('dist/preload.js'), code, 'utf-8');
          const header = generateHeader(code, 'preload_script');
          await fs.writeFile(root('dist/preload.g.h'), header, 'utf-8');
        }
      }
    ]
  }
});

/**
 * Wrap the emitted bundle so it cannot create ANY global variables.
 *
 * The preload bundle is handed to CEF via `frame->execute_java_script()`, i.e.
 * it runs as a *classic script* sharing the League client's own `window`.
 * Top-level `var`/`function` declarations in a classic script become
 * **non-configurable** own properties of `window` (spec: CreateGlobalVarBinding
 * with deletable = false), so they cannot be `delete`d afterwards.
 *
 * Rollup's `iife` format wraps our own modules, but esbuild's minifier hoists
 * its generated helpers (`__defProp`/`__defNormalProp`/`__publicField`, emitted
 * whenever anything in the graph uses class fields) *outside* that wrapper, at
 * the true top level. Minified, those became `var rl`, `var ol` and `var P` —
 * leaking `window.rl`, `window.ol` and `window.P` into the client.
 *
 * `rcp-fe-lol-shared-components` uses `window.P` as a temporary global and then
 * cleans it up with `delete window.P` from strict-mode code. Against a plain
 * client that succeeds; against ours the property was already non-configurable,
 * so the delete threw `TypeError: Cannot delete property 'P' of #<Window>`,
 * aborting that plugin's initialization and hanging client startup forever at
 * "[startup] Waiting for Home Hubs to load".
 *
 * The minified helper names are an unstable build detail — any bundle change
 * can re-roll them onto a different Riot global. So rather than dodge one name,
 * seal the whole script: inside a function body those declarations are
 * function-scoped and touch `window` not at all. Everything the client is meant
 * to see is still exported deliberately via explicit `window.X = ...` writes in
 * src/preload/index.ts.
 *
 * Guarded by tests/preload_globals.test.mjs.
 */
function sealGlobalScope(code: string) {
  return `(function(){
${code}
})();
`;
}

function generateDevLoader(port: number) {
  const template = function (port) {
    document.addEventListener('DOMContentLoaded', async () => {
      // @ts-ignore
      await import(`https://localhost:${port}/@vite/client`);
      // @ts-ignore
      await import(`https://localhost:${port}/src/views/index.tsx`);
    });
  }
  return `!(${template.toString()})(${port});`;
}

function generateHeader(code: string, name: string, lineLength = 12) {
  const bytes = [...Buffer.from(code, 'utf-8')]
    .map(c => '0x' + c.toString(16).padStart(2, '0'));

  const formatted = Array<string>();
  for (let i = 0; i < bytes.length; i += lineLength) {
    const line = bytes.slice(i, i + lineLength).join(', ');
    formatted.push(line);
  }

  return `#ifndef _${name.toUpperCase()}_H_
#define _${name.toUpperCase()}_H_

static const unsigned int _${name}_size = ${bytes.length};

static const unsigned char _${name}[${bytes.length + 1}] = {
  ${formatted.join(',\n  ')}
};

#endif`
}