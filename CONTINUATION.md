# Continuation notes — Vanguard-era crash investigation (2026-09-06)

Session paused mid-investigation. Read this fully before touching anything —
there is a **confirmed, real fix already found and tested live**, plus an
**unrelated second issue** currently being bisected. Don't re-litigate either
without reading the evidence below first.

---

## TL;DR for whoever resumes

1. The original complaint ("app/League client won't open") was caused by a
   real bug in our fork's C++ — **found and fixed, confirmed working live**.
2. A **second, separate, non-crashing issue** surfaced right after: the
   client now stays open (no more crash-loop) but gets stuck on the loading
   screen forever. Root cause not yet found. Bisection in progress.
3. Several files in the working tree currently have **temporary diagnostic
   disables** (commented-out code) from that bisection — see "Uncommitted
   working-tree state" below. Don't confuse those with real fixes.

---

## Issue #1 — RESOLVED: the crash that kept the client from opening

### Symptom
`LeagueClientUxRender.exe` crashed deterministically on every single launch
with `0xC0000005` (access violation) inside `libcef.dll`, always at the same
offset. This happened regardless of activation method (`version.dll` proxy
symlink vs IFEO `rundll32` debugger key), regardless of MSVC toolset used to
compile (`v143` via GitHub Actions CI vs `v145` locally), and regardless of
whether any of our injected JS actually executed. The *official* Pengu
Loader release (`C:\Program Files\Pengu Loader`, v1.1.6, Dec 2024) does NOT
crash against the same live League client — confirmed by the user directly
testing it.

### Root cause (confirmed via a real WinDbg stack trace off a live crash dump)
```
libcef!cef_v8value_create_promise+0x1609   <- invalid pointer read, the actual fault
core!V8Object::set+0x17
core!LoadPlugins+0x304
core!Hooked_OnContextCreated+0x83
```
`LoadPlugins()` in [core/src/renderer/renderer.cc](core/src/renderer/renderer.cc)
was calling `window->set()` **twice** with the *same* underlying CEF V8
object pointer (`pengu`), once for `window.Pengu` and once for
`window.Companion`:
```cpp
window->set(&u"Pengu"_s, pengu, V8_PROPERTY_ATTRIBUTE_READONLY);
window->set(&u"Companion"_s, pengu, V8_PROPERTY_ATTRIBUTE_READONLY);   // BUG
```
`V8Object::set()` ([core/src/renderer/v8_wrapper.h:111-114](core/src/renderer/v8_wrapper.h#L111-L114))
forwards straight to CEF's `set_value_bykey()` with **no visible add_ref**.
Handing the same value to two property slots is a double-ownership bug:
whichever slot's reference gets released first frees the underlying object,
and the second slot is left pointing at freed memory — a classic
use-after-free. This explains every observed symptom:
- Deterministic fault location, but *timing-dependent whether it actually
  crashed* (sometimes the freed memory hadn't been overwritten yet) — this is
  why it crashed the overwhelming majority of the time but very occasionally
  "won the race" and opened fine.
- Crash lives inside `libcef.dll`'s V8 internals, not in our own code.
- 100% independent of JS content/toolset/activation method, because it's
  pure native C++ that runs before any injected JS executes at all.
- Specific to this fork: upstream's `LoadPlugins` only ever does
  `window->set(&u"Pengu"_s, pengu, ...)` once. `window.Companion` was already
  being created safely on the JS side as a plain reference copy
  (`plugins/src/preload/index.ts`: `(window as any).Companion = window.Pengu`)
  — the native second `set()` call was entirely redundant *and* the bug.

### Fix (already applied, confirmed working live)
[core/src/renderer/renderer.cc](core/src/renderer/renderer.cc) — removed the
redundant `window->set(&u"Companion"_s, ...)` call, left a comment explaining
why. **This fix is uncommitted** — see below.

### How it was found
Two GitHub-Actions-CI-toolset-vs-local-toolset builds, an upstream vs our-fork
full source diff (against the actual `v1.1.6` git tag, cloned fresh — NOT
against `PenguLoader/PenguLoader`'s `main` branch, which is an unrelated
in-progress v1.2.0 rewrite and a bad comparison baseline), and finally a real
crash dump analyzed with WinDbg. See "Local tooling now available" below —
all of this is still installed and usable for future investigations.

**Earlier false leads, already ruled out** (don't re-investigate these):
- `fix_browser_background()`'s byte-pattern hook in `libcef.cc` — genuinely
  unsafe code (fixed defensively anyway, kept), but not the actual cause;
  it's browser-process-only and the crash is in the renderer process.
- Activation method (symlink vs IFEO) — both crash identically with the
  buggy build.
- MSVC toolset version (CI's v143 vs local v145) — both crash identically.
- The native theming engine's `Element.prototype.attachShadow` override —
  disabled it, crash persisted unchanged.
- Disabling ALL injected JS execution entirely — crash persisted unchanged
  (this is what proved it was pure C++, not JS).

---

## Issue #2 — UNRESOLVED: stuck on the loading screen after the crash fix

### Symptom
With Issue #1 fixed, the client no longer crash-loops — it opens and stays
open — but never gets past the "Pengu-Powered" loading splash (this splash
itself is normal/cosmetic, it's the client's own native `index_loading_div`
restyled, present in upstream too). Log shows it's genuinely stuck, not just
slow:
```
[startup] The plugin rcp-fe-lol-shared-components has thrown an error when initializing: TypeError: Cannot delete property 'P' of #<Window>
[startup] Waiting for Home Hubs to load        <- never proceeds past this
```
`rcp-fe-lol-shared-components` is a **native Riot client plugin**, not ours.
"Cannot delete property 'P' of #<Window>" is consistent with something
declaring a `var P = ...` at global/script scope (non-configurable per spec)
and something else later doing `delete window.P` in strict-mode code, which
throws instead of silently failing. The client's own log showed this
navigation had `transitionType = "TT_RELOAD"` — worth investigating whether
this is a context-reuse artifact across the reload rather than anything
J S-content-specific.

### Bisection status (updated — most recent findings first)

**Ruled out so far, confirmed by direct live testing (each one individually
disabled+rebuilt+relaunched, error persisted unchanged every time):**
- Ember/Net preload hooks (`emberHook.install()` / `netHook.install()` in
  `plugins/src/preload/index.ts`).
- The native theming engine's `installNativeTheming()` /
  `Element.prototype.attachShadow` override
  (`plugins/src/preload/theming/index.ts`).
- `plugins/src/preload/load-hooks.ts` (the global
  `window`/`document.addEventListener` override for late 'load'/
  'DOMContentLoaded' registrations) — looked like a very strong candidate
  (much bigger surface than ember/theming) but disabling it changed nothing.
- The companion app failing to load (early tests were missing
  `bin/plugins/@companion/index.js` entirely — incomplete test folder, not a
  real bug; once properly staged via `pnpm build:app` + copy, per CI's
  "Stage first-party companion app" step, companion loads fine
  (`[Companion] Initialized successfully...`) but the error and hang persist
  regardless of whether companion loads or 404s).

**Confirmed NOT a pre-existing/unrelated Riot bug** — this was the big
finding right before the session paused: swapped the IFEO `Debugger` key
back to the **official Pengu Loader** (`C:\Program Files\Pengu Loader\core.dll`)
and relaunched. Its log shows **zero** occurrences of "Cannot delete
property", `rcp-fe-lol-shared-components` initializes cleanly ("Get machine
spec, detail=5"), and `[startup] Home Hubs are loaded` completes in ~8
seconds, no `TT_RELOAD` anywhere in the whole session. So this is 100%
something specific to our fork's *remaining* preload code (not a client-side
race that would happen regardless of loader).

**Also established**: the extra `TT_RELOAD` navigation seen in our broken
sessions is a *symptom*, not the cause — log timestamps show the "Cannot
delete property 'P'" error and the "Waiting for Home Hubs to load" hang
happen ~5 seconds *before* the reload fires. The reload is almost certainly
Riot's own client-side watchdog/self-heal kicking in because Home Hubs never
finished loading, not something we trigger directly. Don't waste time
chasing "what causes the reload" — chase the underlying hang/error instead.

**Not yet tested — this is the next step**: whether the error happens at all
with **zero of our JS executing** (same technique used to prove Issue #1 was
pure C++): in `core/src/renderer/renderer.cc`'s `ExecutePreloadScript()`,
comment out the `frame->execute_java_script(frame, &script, nullptr, 1);`
call (keep the `#include` and `CefStr script{...}` construction — only skip
executing it), rebuild plugins+core, relaunch, check the log. This was
**in progress but not completed** when the session was cleared/paused:
- If the error disappears with zero JS executing → it's something in our
  remaining preload code. Suspects not yet individually bisected, roughly in
  order of suspicion (see "Still unexamined" below).
- If the error *still* happens with zero JS executing → it's not
  content-dependent at all; look at C++-level timing/overhead instead (our
  `core.dll` is much bigger than upstream's and does more work in
  `Hooked_OnContextCreated`/`Hooked_CefBrowserHost_CreateBrowser` before
  control returns to CEF — maybe that alone shifts timing enough to expose a
  pre-existing race in Riot's own `rcp-fe-lol-shared-components`/
  `rcp-fe-lol-lock-and-load` startup sequence that upstream's much lighter
  hook never manifests).

**Still unexamined** (read these next if the zero-JS test comes back
"still content-dependent"):
- `plugins/src/preload/rcp/hooks.ts` — the `RCP` class. This is the core
  mechanism (likely present in upstream too, but never actually diffed
  against it this session — check!) that wraps `document.dispatchEvent`
  globally to intercept every `riotPlugin.announce:*` event, and further
  wraps each announced plugin's `registrationHandler` to inject pre/post-init
  callback hooks around Riot's own plugin registrars. `rcp-fe-lol-lock-and-load`
  (the very startup manager currently getting stuck) almost certainly
  registers itself through this exact path — a very plausible place for a
  subtle interference bug. **Not yet diffed against upstream v1.1.6, not yet
  bisected by disabling.**
- `plugins/src/preload/loader.ts` — the plugin-loading orchestrator (loads
  user plugins + the companion app, does the `disabledPlugins` hash-blacklist
  dance). Read this session, nothing obviously wrong found (the one `delete
  window.Pengu.disabledPlugins` targets `window.Pengu`, not `window` itself,
  so it doesn't match "Cannot delete property 'P' of #<Window>" literally —
  but ES module import-hoisting semantics mean this file's top-level code
  actually runs *before* `index.ts`'s own trailing `Object.freeze(window.Pengu)`
  and IPC-install statements, despite being textually imported after them;
  worth double-checking the *actual* runtime order under bundling/minification
  rather than trusting source order).
- `plugins/src/preload/api/index.ts`, `DataStore.ts`, `Effect.ts` — not read
  closely this session at all.
- `plugins/src/preload/super-potato.ts` — patches `document.createElement`
  globally, but gated behind `window.Pengu.superPotato` which defaults to
  `false` and is off in the test config, so it shouldn't be active; low
  suspicion but technically unconfirmed inactive at runtime.

**Also worth doing, not done yet**: a full source diff of `plugins/src/`
against the actual `v1.1.6` tag (already cloned this session — see
"upstream comparison" path below), the same way `core/src` was diffed for
Issue #1. This was never done for the JS/TS side, only for the C++ side.
Could shortcut a lot of the manual file-by-file reading above.

---

## Uncommitted working-tree state — READ BEFORE COMMITTING ANYTHING

`git status --short` currently shows:
```
M CONTINUATION.md
M core/src/renderer/renderer.cc
M plugins/src/preload/index.ts
```
(`plugins/src/preload/theming/index.ts` was disabled-then-restored to its
exact original content during bisection, so it shows no diff — theming is
back to normal/enabled, ruled out as Issue #2's cause.)

- **`core/src/renderer/renderer.cc`** — this is the REAL, confirmed fix for
  Issue #1 (removed the duplicate `window->set()`). Safe and correct to
  commit on its own, independent of Issue #2's outcome.
- **`plugins/src/preload/index.ts`** — currently has `import './load-hooks';`
  commented out (temporary diagnostic disable, mid-bisection for Issue #2 —
  see status above, not yet confirmed either way). Ember/Net hook
  installation in this same file was ALSO temporarily disabled earlier in
  the session but **has since been re-enabled** (ruled out, confirmed not
  the cause) — so the only live diff here right now is the `load-hooks`
  import being commented out. Must be resolved (re-enabled if ruled out, or
  fixed properly if confirmed as the cause) before shipping.

None of this has been committed. The only thing actually pushed to `origin/main`
so far this session is commit `789802c` ("fix(core): disable unreliable
libcef background-color pattern hook") — that one is a real, harmless
defensive improvement (kept), but it was based on an **incorrect diagnosis**
at the time (thought it was the crash cause; it wasn't — see Issue #1 above).
Don't re-revert it, it's fine to keep, just don't rely on it as "the fix" in
any release notes.

Also: **do not create the v1.0.5 release yet** — the user asked for it
mid-session but Issue #2 means the client still doesn't fully open. Hold off
until both issues are resolved and confirmed live.

---

## Upstream comparison checkout

The actual working `v1.1.6` tag (NOT `PenguLoader/PenguLoader`'s `main`
branch — that's an unrelated in-progress v1.2.0 rewrite, bad baseline) is
already cloned in the scratchpad at:
```
<session scratchpad>/pengu-v1.1.6/
```
(session scratchpad = `C:\Users\Perseus\AppData\Local\Temp\claude\c--Users-Perseus-Documents-antigravity-Loader\<session-id>\scratchpad\` —
that exact `<session-id>` path is almost certainly gone in a fresh session;
just re-clone if needed: `git clone --depth 1 --branch v1.1.6 https://github.com/PenguLoader/PenguLoader.git`)
its `core/src` was already fully diffed against ours for Issue #1 (see
lessons above) but its `plugins/src` (JS/TS side) was **never diffed** —
worth doing for Issue #2 before manually re-reading every file.

## Local tooling now available (installed this session, still present)

- **Visual Studio Community 2026 ("18")**, `Desktop development with C++`
  workload, at `C:\Program Files\Microsoft Visual Studio\18\Community`.
  MSVC toolset installed: `14.51.36231` (referred to as `v145`).
  Build command used all session (run from repo root):
  ```
  "/c/Program Files/Microsoft Visual Studio/18/Community/MSBuild/Current/Bin/MSBuild.exe" pengu.sln -t:core -p:Configuration=Release -p:Platform=x64 -p:PlatformToolset=v145
  ```
  (The project's own `core.vcxproj` is pinned to `v143`, which this VS
  install doesn't have — hence the `-p:PlatformToolset=v145` override rather
  than editing the `.vcxproj`.) Output goes to `bin/core.dll` (repo-root
  `bin/`, not `core/bin/`). **Kill `LeagueClientUx.exe`, `LeagueClientUxRender.exe`,
  and `rundll32.exe` first** or the linker fails with `LNK1104` (file in use)
  — this happens almost every time since whichever one is currently
  activated holds the DLL open.
  For a genuinely clean rebuild (needed at least once — MSBuild's
  incremental tracking silently failed to notice `preload.g.h` content
  changes once mid-session and relinked a stale embedded script), run
  `-t:core:Clean` first, then the normal build.
- **ProcDump** (Sysinternals), extracted at
  `<scratchpad>/procdump/procdump64.exe` (not on PATH). Plain
  `-w <name>` mode fails outright with "Multiple processes match the
  specified name" whenever more than one `LeagueClientUxRender.exe` already
  exists (which is often, given GPU/utility renderer processes persist
  across restarts) — it does NOT wait for a new one in that case, it just
  gives up silently. Use **PID-targeted** monitoring instead: poll
  `Get-Process -Name LeagueClientUxRender` for new PIDs not seen before and
  launch a separate `procdump64.exe -accepteula -ma -e 1 -n 3 <PID> <dumpdir>`
  per new PID (a small PowerShell watcher script doing exactly this is what
  finally caught the real crash dump this session).
  Also: `-e` (unhandled-only) is not reliable here — Chromium's own crash
  handler intercepts the AV before it becomes "unhandled" from ProcDump's
  point of view. Use **`-e 1`** (first-chance) and expect to filter out a lot
  of benign noise (`0x406D1388` = benign `SetThreadName`/MS VC++ exception,
  `0x80000003` = benign attach breakpoint) before finding the real
  `0xC0000005`.
- **WinDbg** (modern package, via winget `Microsoft.WinDbg`), executable at
  `DbgX.Shell.exe` under
  `C:\Program Files\WindowsApps\Microsoft.WinDbg_1.2606.22001.0_x64__8wekyb3d8bbwe\`.
  It DOES support classic batch-mode scripting despite being a WinUI shell:
  ```
  DbgX.Shell.exe -z <dumpfile> -c "!analyze -v; ~*k; qd" -logo <logfile>
  ```
  Runs in the background (returns quickly to the shell) and writes plain
  text to `-logo`'s log file — read that file for the analysis instead of
  trying to capture stdout. `qd` reliably quits it; a bare `q` did not
  always fully exit the shell process. Symbol loading for `libcef.dll`
  itself always fails ("cannot find the file specified", no public PDB
  available) but the *offsets* and *nearest-export* resolution are still
  enough to identify which of *our* functions (`core!...`) called into it —
  that's how Issue #1 was actually found.

## Test environment currently pointed at our local build

IFEO `Debugger` value for `LeagueClientUx.exe` (`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe`)
currently points at:
```
rundll32 "C:\Users\Perseus\Documents\antigravity\Loader\bin\core.dll", #6000
```
i.e. our local dev build, NOT the official Pengu Loader. `bin/` now also has
a manually-staged `plugins/@companion/index.js` (copied from `app/dist/`,
matching what CI's package step does) so the companion app loads.

**Claude Code could not write this registry key directly** — Claude Code's
auto-mode classifier blocks writes to `Image File Execution Options` as a
sensitive/high-risk action regardless of context. The user has been running
these two PowerShell commands manually each time (as Administrator) to swap
between our build and the official one:
```powershell
# Point at our local build:
$key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe'
Set-ItemProperty -Path $key -Name Debugger -Value 'rundll32 "C:\Users\Perseus\Documents\antigravity\Loader\bin\core.dll", #6000'
Get-Process -Name "LeagueClientUx" -ErrorAction SilentlyContinue | Stop-Process -Force
```
```powershell
# Restore the official Pengu Loader:
$key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe'
Set-ItemProperty -Path $key -Name Debugger -Value 'rundll32 "C:\Program Files\Pengu Loader\core.dll", #6000'
Get-Process -Name "LeagueClientUx" -ErrorAction SilentlyContinue | Stop-Process -Force
```
Whoever resumes: expect to keep asking the user to run one of these two
blocks and to relaunch League each time you need a fresh test.

---

## Immediate next step for whoever resumes

1. Ask the user to relaunch League against the current build (theming
   disabled, already rebuilt) and check whether "Cannot delete property 'P'"
   / the Home-Hubs hang still happens.
2. If it's gone: the theming engine's `attachShadow` override is Issue #2's
   cause — needs a proper redesign (not just leaving it disabled — theming
   is a real, wanted feature), most likely scoping the patch or the
   stylesheet adoption instead of a blanket global override.
3. If it's still there: move to the "next things worth checking" list under
   Issue #2 above, starting with checking whether the official Pengu Loader
   exhibits the same log line.
4. Once Issue #2 is resolved: re-enable Ember/Net hooks
   (`plugins/src/preload/index.ts`), confirm nothing regressed, commit the
   real fixes (renderer.cc at minimum, plus whatever fixes Issue #2), full
   verification pass (`pnpm test`, `pnpm typecheck`, `pnpm build`), *then*
   consider cutting v1.0.5.
