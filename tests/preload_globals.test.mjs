// The preload bundle is executed by core.dll via CEF's `execute_java_script()`,
// which runs it as a *classic script* on the League client's own `window`.
// Top-level `var`/`function` declarations in a classic script become
// non-configurable own properties of `window`, which the client can then never
// `delete`. Riot's own plugins do exactly that with short-lived globals:
// `rcp-fe-lol-shared-components` assigns `window.P` and later deletes it from
// strict-mode code. When our bundle had already created `var P` (esbuild's
// minified `__publicField` helper, hoisted outside rollup's IIFE), that delete
// threw `TypeError: Cannot delete property 'P' of #<Window>`, aborting the
// plugin's init and hanging client startup at "Waiting for Home Hubs to load".
//
// The bundle must therefore create ZERO globals. See sealGlobalScope() in
// plugins/vite.config.ts.

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(repoRoot, 'plugins', 'dist', 'preload.js');

/**
 * Returns the names the script binds on the global object.
 *
 * `var`/`function` declarations are instantiated during
 * GlobalDeclarationInstantiation — before the first statement executes — so
 * they are observable even though the bundle throws immediately in Node for
 * want of a DOM.
 */
function globalsCreatedBy(source) {
  const sandbox = vm.createContext(Object.create(null));
  const before = new Set(Object.getOwnPropertyNames(sandbox));
  try {
    vm.runInContext(source, sandbox, { filename: 'preload.js' });
  } catch {
    // Expected: no DOM in Node. Hoisting has already happened by now.
  }
  return Object.getOwnPropertyNames(sandbox).filter(n => !before.has(n));
}

test('sealGlobalScope wraps top-level declarations away from the global object', () => {
  // Reproduces the shipped-bug shape: esbuild's class-field helpers hoisted
  // above rollup's IIFE, exactly as plugins/dist/preload.js looked before the fix.
  const unsealed = [
    'var rl=Object.defineProperty;',
    'var ol=(E,N,H)=>N in E?rl(E,N,{enumerable:!0,configurable:!0,writable:!0,value:H}):E[N]=H;',
    'var P=(E,N,H)=>ol(E,typeof N!="symbol"?N+"":N,H);',
    '(function(){"use strict";})();',
  ].join('');

  assert.deepEqual(
    globalsCreatedBy(unsealed).sort(),
    ['P', 'ol', 'rl'],
    'precondition: the unsealed shape is expected to leak these three helpers',
  );

  // sealGlobalScope() is TS inside vite.config.ts; mirror its single expression
  // here so the guarantee itself is under test without importing the config.
  const sealed = `(function(){\n${unsealed}\n})();\n`;

  assert.deepEqual(
    globalsCreatedBy(sealed),
    [],
    'wrapping the bundle in a function body must bind nothing on the global object',
  );
});

test('the built preload bundle creates no global variables', (t) => {
  if (!fs.existsSync(bundlePath)) {
    t.skip('plugins/dist/preload.js not built (run `pnpm build:plugins`)');
    return;
  }

  const leaked = globalsCreatedBy(fs.readFileSync(bundlePath, 'utf8'));

  assert.deepEqual(
    leaked,
    [],
    `preload.js must not create globals on the client's window; leaked: ${leaked.join(', ')}. ` +
    'Any such name is non-configurable in a classic script and breaks Riot plugins ' +
    'that delete same-named temporary globals.',
  );
});
