# Continuation notes — Riot Loader enhancement + Snooze Manager integration

Session paused mid-Phase-7 at the user's request ("stop, write a continuation doc").
**The working tree currently does NOT build** — see "Known broken state" below. Fix that
first, before anything else.

Original plan: `C:\Users\Perseus\.claude\plans\enhance-the-current-code-flickering-codd.md`
(still accurate as the source of truth for scope/design intent — this doc is a status
snapshot on top of it, not a replacement).

## How to resume

Read this file, then re-read the plan file above for full context (design direction,
phase list, defect table). Everything below assumes that context.

---

## Known broken state — fix this first

`pnpm build` fails in `loader/` with a Tailwind v4 / Lightning CSS parse error:

```
[@tailwindcss/vite:generate:build] Unterminated string: 's --color-* utility namespace, for the plain utility classes'
file: loader/src/App.css
```

**Cause:** `packages/ui/src/tokens.css`'s new header comment contains an apostrophe
(`Tailwind's --color-* utility namespace`) inside a `/* */` block. Something in the
Tailwind v4 / Lightning CSS chain appears to mis-parse a bare apostrophe inside a CSS
comment as the start of a string literal. `loader/src/App.css` is just the entry point
that `@import`s `tokens.css`, so the error is attributed there.

**Fix:** open `packages/ui/src/tokens.css`, find the top-of-file comment block, and
remove/reword the apostrophe (e.g. "Tailwind's" → "Tailwind"). Then rerun `pnpm build`
to confirm. This was caught mid-edit — the comment was just rewritten (see "What was
in-flight" below) and never verified before the stop request landed.

After that fix, re-verify the SAME class of bug isn't present elsewhere: search
`packages/ui/src/tokens.css` and any other `.css` file touched this session for stray
apostrophes inside comments.

**Once the build is green again**, run the full verification sequence before doing
anything else:
```
pnpm install
pnpm typecheck
pnpm test
pnpm build
```
Last known-good numbers (before this final edit): 84/84 tests passing, clean typecheck,
clean build across all three workspaces (`pengujs`, `riot-loader`, `companion-app`).

---

## What's fully complete, verified, and safe to build on

**Phases 0–6 of the plan are entirely done, tested, and were green as of the last full
verification pass** (before the tokens.css edit that broke the build). This covers:

- Phase 0 — truth pass (defect fixes: `insecure_mode` typo, version single-sourcing, dead
  deps removed, CI Node 24, etc.)
- Phase 1 — missing wiring (`startup.rs`, `CommandBar.removeAction`, scoped-store
  localStorage fallback, `ext.fs`/`ext.assets` split, companion CSS/packaging)
- Phase 2 — `packages/*` workspace scaffold (proved via identical test results before/after)
- Phase 3 — "Instrument & HUD" redesign of both apps (loader + companion), shadow-root
  mount for the companion, Tailwind v3→v4 migration
- Phase 4 — theming loop closed (`ThemeManager.vue` restored as `TabThemes.vue`, the
  missing preload-side theme-read fixed, cross-process write guard added)
- Phase 5 — i18n infrastructure (`packages/i18n`, vue-i18n v9, full loader coverage)
- Phase 6 — `pengu.yml` manifest support (`packages/contracts/src/manifest.ts`, `.js_`
  classification fix, rich gallery cards)

Do not re-litigate or redo any of this — it's done. If you find something in this range
that looks wrong, verify against a fresh `git log`/`git diff` before assuming it's broken;
it's more likely a misreading than a regression.

## Phase 7 (module kernel) — substantial progress, not finished

**Done and was tested (11+11+12+19 = new tests across 4 suites, all passing before the
break):**

- `packages/lcu` — full port of Snooze Manager's `Utils.LCU` (bind/unbind/observe with
  rebind re-subscription, per-observer error isolation, get/post/put/patch/delete) plus
  its SGP client. Fixed two real bugs in the process:
  - The fork's real socket (`plugins/src/preload/rcp/socket.ts`) delivers a wrapped
    `{data, uri, eventType}` envelope. `LcuClient.observe()` unwraps this centrally so
    callers get raw data — this is a **deliberate divergence** from how Snooze's own
    modules read `e.data` themselves at the call site. Any newly-ported module must NOT
    do `.data` unwrapping itself; `ctx.lcu.observe()` already gives raw values.
  - Replaced `app/src/services/sgp/index.ts`'s wrong hostnames (`*-blue-1`, non-functional)
    and its fabricated-fallback-data catch block (now throws instead of lying to the UI).
  - `app/src/composables/useLcuSocket.ts` no longer reaches into
    `window.__companion_context` directly; it goes through `lcuClient.observe()`.
  - Test file: `tests/lcu.test.mjs`.

- `packages/contracts` additions:
  - `src/module.ts` — `ModuleDescriptor`, `SettingsSchema` (8 field types: toggle, select,
    number, text, textarea, hotkey, info, custom), `PassivePolicy`,
    `validateModuleDescriptor()`, `validateAutoActsRegisterPanic()` (the static
    autoActs⇒panic invariant check). Test file: `tests/module_descriptor.test.mjs`.
  - `src/snooze-migration.ts` — `migrateSnoozeStore()`, the pure migration function moving
    a user's Snooze settings out of the shared `window.DataStore` into the new per-plugin
    store. Verified against **all 28** of Snooze's real `LEGACY_MIGRATION_MAP` entries
    (`index.js:1909`), the JSON-string coercion behavior, idempotency, and the
    Snooze-Modules→Snooze-Store promotion path. **Never deletes legacy keys** (deliberate
    divergence from Snooze's own behavior — see the file's doc comment for why). Test file:
    `tests/snooze_migration.test.mjs` — this is "the single highest-value test in the
    refactor" per the plan; if anything in this area regresses, this suite will catch it.

- `app/src/modules/` — the actual runtime, built and wired to a **real** first module
  (Tier 1's `useClientDuringGame`, deliberately first per the plan since it's the
  passive-policy edge case):
  - `types.ts` — `ModuleContext` (lcu, store, toast, panic, log, phase).
  - `host.ts` — `ModuleHost` class: static registry validation at `register()` time,
    crash-disable after 3 throws, one shared phase feed (free — `LcuClient.observe()`
    already fans one subscription out to every caller), `strict` modules get
    unload-on-InProgress/reinit-on-leave, `passive-dom`/`active` modules keep running and
    self-manage phase awareness, `setModuleSetting()`/`getModuleSetting()` for the
    settings UI, `panicAll()`, reverse-order teardown.
  - `useClientDuringGame.ts` — the ported module itself. Uses `capabilities.passive:
    'passive-dom'`. Has an `onSettingChange` hook (a new addition to `ModuleDescriptor`,
    not in the original plan text — replaces Snooze's inline `settings[].onChange`
    callbacks with a separate optional lifecycle method, so the schema stays purely
    declarative).
  - `registry.ts` — the static `MODULE_REGISTRY` array (just this one module so far).
  - `index.ts` — `bootstrapModules(context)` / `loadModules()`, wired into `app/index.ts`'s
    `init()`/`load()`. Also extended the Ctrl+Shift+Alt+K kill-switch to call
    `moduleHost.unloadAll()` (previously it only unmounted Vue — a real gap the plan
    flagged).
  - `packages/ui/src/SettingsSchemaRenderer.vue` — shared renderer for all 8 field types,
    designed to work in both the loader (Phase 13, future) and the companion (now) since
    it only uses the shared token vocabulary, no workspace-specific classes.
  - `app/src/components/modules/ModulesView.vue` + a new `/modules` route + TabBar entry —
    so the registry is actually visible/testable, not just plumbing.
  - Also fixed `app/src/composables/useDataStore.ts` (defect from the plan: it was writing
    through the global `window.DataStore` instead of `context.ext.store`, causing a
    full-file rewrite on every settings change).

**Also fixed while working on tokens.css (the change that's currently broken — see
above):** discovered and fixed a **real, pervasive bug** across all of Phase 3's work —
`packages/ui/src/tokens.css` originally declared primitives under an `--rl-` prefix
(`--rl-border`, `--rl-hud-scrim`, etc.) but nearly every consumer across both apps
(`.riot-card`, `.hud-panel`, every `bg-[var(--hud-border)]` arbitrary-value class in the
Vue templates) references the **bare** name (`var(--border)`, `var(--hud-scrim)`), which
was never actually defined. This means **borders, backgrounds, and text colors were
silently not resolving throughout the entire Phase 3 redesign** — a real regression that
was never visually caught because verification only checked that hex values appeared
*somewhere* in the compiled CSS, not that the specific selectors actually resolved. The
fix (already applied, just not yet verified to build): `tokens.css` now declares
`--border`, `--surface`, `--hud-scrim`, etc. directly as the primitives, with `@theme`
mapping a subset of them to Tailwind's `--color-*` namespace for utility classes. Also
moved `SettingsSchemaRenderer.vue`'s styles into `tokens.css` as global `.ssr-*` classes
instead of a component-scoped `<style>` block, because Vite would otherwise emit a
separate `dist/style.css` for the companion's build (which nothing loads — same class of
bug as the original defect #9 CSS-shipping problem).

**Action item once the build is fixed:** actually look at the loader and companion in a
running client (or at minimum a browser render of the built output) to visually confirm
borders/backgrounds/colors are now rendering correctly. This was never done for the
Phase 3 redesign and should have been — don't repeat that gap.

### What's left in Phase 7

- `ctx.ext.ember` / `ctx.ext.net` preload hooks (port `Utils.Hooks.Ember` /
  `Utils.Hooks.Fetch` from `generalUtils.js:606` and `:936`) — **the highest-risk piece**,
  ships compiled into `core.dll` with no JS-level rollback. Plan mandates: try/catch every
  preload patch, add a `no_preload_ext=1` config escape hatch read at preload time, and
  ship this in its own release with nothing else in it.
- `window.Toast` gains `info`/`warning`/`dismiss` (currently only `success`/`error`) — see
  `plugins/src/views/components/Toaster.tsx`. `app/src/modules/index.ts`'s `createToast()`
  already degrades gracefully if these aren't present, so this is additive, not blocking.
- No other module has been ported yet. Tier 1 remaining: `champSelectQuitButton` (137
  lines), `aramNocd` (160 lines, first Ember consumer), `PenaltyUISuppress` (497 lines).
  See the plan's full tiering (Tiers 1–5, 18 modules total) for the order after that.

## Phases 8–13 — not started

The bulk of the actual Snooze Manager port (18 modules, ~20k lines) into a `personal/`
workspace (per the user's explicit instruction: separate from the shipped app, since
Snooze has no LICENSE and this is personal use only — see the plan's licensing section).
Nothing in `personal/` exists yet; it hasn't been created.

---

## Lessons worth preserving for whoever resumes this

1. **Verify CSS token resolution by grepping the compiled output for the actual bare
   variable name being used** (`grep -o "\-\-border:[^;]*" dist/*.css`), not just for the
   presence of expected hex values anywhere in the file. The `--rl-` bug above would have
   been caught immediately by this check and wasn't.
2. **A literal `*/` sequence inside a `/** */` block comment prematurely closes it** —
   happened once already in `SettingsSchemaRenderer.vue` (`.riot-*/.hud-*` in prose). Read
   comment text for this before writing it, not after the parser complains.
3. **Node's native TS stripping needs explicit `.ts` extensions on relative imports** and
   explicit `with { type: 'json' }` on JSON imports — Vite doesn't need either, so a file
   can build fine and still fail under bare `node --test`. Always run the test suite, not
   just the build, after touching a file under `packages/*`.
4. **pnpm workspace bare-specifier resolution (`@riot/x`) works under plain Node too**,
   since it's real `node_modules` symlinking, not a Vite-only alias trick — this is what
   makes the `packages/contracts`/`packages/lcu` "must stay Node-testable" rule enforceable
   without a bundler in the test loop.
5. When porting a Snooze module, **do not replicate its `.data` unwrapping** in observe
   callbacks — `packages/lcu`'s `LcuClient.observe()` already does that centrally (see
   Phase 7 notes above). This is the one deliberate behavioral divergence from a faithful
   port and it would be an easy thing to silently un-fix by copying Snooze's code too
   literally.
