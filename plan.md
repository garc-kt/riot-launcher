# LoL Companion Platform — Development Plan (Fork Track)

A full fork of PenguLoader: our own injector, our own launcher, and our own companion app bundled as the first-party experience — not a plugin riding on someone else's loader.

**Upstream is MIT-licensed** (`Copyright (c) 2024 Pengu Loader`), which permits use, modification, distribution and sublicensing, including commercially. The only hard obligation: **keep the original copyright notice and MIT permission text in the distribution.** Attribution is required; asking permission is not.

**Platform: Windows only.** macOS is not in scope at any level — the `OS_MAC` / `OS_WIN` conditional branches, the `makefile`, the Objective-C++ sources (`utils/cocoa.mm`, `utils/dylib.cc`), and the mac half of `config.cc` all get deleted from our tree, not left inert. Trade-off accepted knowingly: pulling future upstream fixes becomes a manual port rather than a clean merge. In exchange the codebase is a straight Win32 project with no dead platform branches, which is simpler to read and to maintain.

---

## 0. Scope & Risk Posture (read before writing code)

**What this fork touches:** the League *client* shell only — `LeagueClientUx.exe` (browser process) and `LeagueClientUxRender.exe` (renderer process). It never touches `League of Legends.exe`, the game engine, or game memory.

**Risk assessment, stated honestly:**
- Vanguard's enforcement targets injection and memory tampering in the *game* process. Documented 2025–2026 ban waves hit injector-based skin changers operating there — a different category from client-shell tooling.
- The strongest empirical evidence is upstream's own track record: years of operation, large userbase, no documented ban wave targeting it. Our fork uses the identical mechanism against the identical targets, so its technical risk profile should resemble upstream's.
- **But:** low risk ≠ permitted. Riot's ToS prohibits unauthorized client modification with no carve-out for "cosmetic" or "client-only." What exists is de-facto enforcement tolerance, not authorization — and tolerance can change without notice.
- **A fork forfeits the one asset upstream has that we don't: history.** Same technique, zero accumulated reputation. Our own bugs (a `CreateProcessW` race, a crash in a suspended process) produce anomalous client behavior that draws attention on its own merits, independent of anti-cheat.
- **Policy risk is separate from detection risk.** Specific features (cross-player lookup via SGP, §6) fall under Riot's acceptable-use rules regardless of whether Vanguard ever notices them. Two different risk axes, evaluated separately.

**Design rule adopted:** the companion app goes fully passive on `gameflow-phase === 'InProgress'` — unmount UI, no fetches, no DOM work until the game ends. This narrows observable behavior during a match at zero cost.

**Design rule explicitly rejected:** dynamically unloading/reloading the injected module around match start. It does not work (the module stays mapped in the process regardless of whether its JS is running; a static module scan sees it either way), it is fragile (reverting CEF handler hooks mid-flight risks crashing the client — far more visible than any detection), there is no clean re-entry point (the `CreateProcessW` hook fires once at process spawn), and — decisively — it reframes the project from "modified the client" to "engineered to evade anti-cheat," which is a categorically more serious posture in any review. Not doing it.

---

## 1. Architecture — Three Layers

| Layer | What it is | Stack | Source of truth |
|---|---|---|---|
| **`core/`** | The injected DLL. Hooks CEF, exposes the JS runtime APIs (`DataStore`, `rcp`, `socket`, `Effect`) to the client's V8 context. | C++20, Win32 native | `core/src/` upstream |
| **`launcher/`** | Desktop app: installs/removes the injection hook, manages the plugin folder, system tray, update checks. | **Tauri + Rust + TS frontend** (upstream already uses Tauri 1) | `loader/` upstream |
| **`app/`** | The companion itself — stats, match history, player lookup. Runs inside the injected client. | Vue 3 + TS + Vite (full stack in §4) | ours; upstream's `plugins/` is the reference |

**Key opportunity from the fork:** upstream's launcher is already Tauri, and the standalone companion app was already planned in Tauri. In this fork those converge — **one Tauri application** can both manage injection *and* present the companion UI as a standalone window, instead of three separate deliverables.

---

## 2. Layer 1 — `core/` (the injector)

### 2.1 How injection actually works (verified in `core/src/dllmain.cc` + `dllproxy.cc`)

**Windows — DLL proxying + child-process injection.** The DLL masquerades as a system library the client already loads (`d3d9.dll`, `dwrite.dll`, or `version.dll`), forwarding every real call through to the genuine system DLL:

```cpp
EXTERN_C LPVOID WINAPI Direct3DCreate9(UINT SDKVersion) {
    return Forward_D3D9(Direct3DCreate9)(SDKVersion);
}
```

Once loaded into `LeagueClientUx.exe` (browser process), it hooks `CreateProcessW` to catch the renderer child being spawned, starts it suspended, injects itself, then resumes:

```cpp
bool is_renderer = wcsfindi(lpCommandLine, L"LeagueClientUxRender.exe")
                && wcsfindi(lpCommandLine, L"--type=renderer");
if (is_renderer) dwCreationFlags |= CREATE_SUSPENDED;
// ... after CreateProcessW succeeds:
InjectThisDll(lpProcessInformation->hProcess);
ResumeThread(lpProcessInformation->hThread);
```

`Initialize()` branches on the host executable name — browser process gets `HookBrowserProcess()` plus the `CreateProcessW` hook; renderer process gets `HookRendererProcess()`.

**macOS — removed.** Upstream's mac path (replacing `libEGL.dylib` inside the CEF framework, load-path rewriting via `install_name_tool`) is deleted from our fork entirely. See §2.6 for the strip list.

### 2.2 CEF hook chain (`renderer/renderer.cc`)

```
cef_execute_process
  └─ get_render_process_handler
       ├─ on_browser_created      → detect main browser via extra_info "is_main"
       └─ on_context_created      → if URL matches https://riot:*/index.html:
                                      ExposeOsObject()        → window.os
                                      ExposeNativeFunctions() → window.__native
                                      LoadPlugins()           → window.Pengu { plugins, disabledPlugins, ... }
                                      ExecutePreloadScript()  → runs the compiled preload bundle
```

The preload bundle is **compiled into the binary** in release builds (`#include "../../plugins/dist/preload.g.h"`) and read from disk in debug builds — the JS runtime layer ships inside the DLL, not as loose files.

### 2.3 Plugin discovery (`get_plugin_entries()`)

Three supported layouts, scanned from `plugins_dir()`; names starting with `_` or `.` are skipped:
```
plugins/
├── @author/plugin-1/index.js     # namespaced
├── plugin-2/index.js             # standard directory
└── plugin-3.js                   # top-level single file
```

### 2.4 Fork work items for this layer

- [ ] Rebrand: `window.Pengu` → our own global; `https://plugins/` virtual scheme → ours; binary and product names throughout
- [ ] Keep the MIT notice and upstream copyright in `LICENSE` (non-negotiable, and the only license obligation)
- [ ] Vendor the CEF headers submodule (`PenguLoader/cef-headers`, branch `5359`) or mirror it — pinned to the CEF build the client ships
- [ ] Detect an existing upstream PenguLoader install and refuse to proceed (§9.1) — both proxy the same system DLLs, so silent coexistence produces an undiagnosable half-broken client
- [ ] Own the maintenance burden: every CEF bump by Riot can invalidate hook assumptions — `check_libcef_version()` exists upstream for exactly this reason

### 2.5 Build system (Windows only)

| Platform | Toolchain | Output |
|---|---|---|
| Windows | MSVC, `pengu.sln` / `core.vcxproj` | `core.dll` (proxying d3d9/dwrite/version) |

Requirements: Visual Studio Build Tools with the C++ desktop workload. CEF headers come from the pinned submodule (branch `5359`).

CI: fork upstream's `.github/workflows/build.yml` and reduce it to a single Windows job.

### 2.6 macOS strip list (do this in step 2 of §8)

Delete outright — these are the mac-only pieces in the upstream tree:

| Path | What it is |
|---|---|
| `makefile` | the entire mac build (clang++, `insert_dylib`, hardcoded `/Applications/League of Legends.app` paths) |
| `core/src/utils/cocoa.mm` | Objective-C++ Cocoa helpers |
| `core/src/utils/dylib.cc` | dylib loading/substitution |

Then strip in place:
- Every `#elif OS_MAC` / `#ifdef OS_MAC` branch across `core/src/` — notably in `config.cc` (`loader_dir()` has a full `dladdr`-based mac implementation), `dllmain.cc`, `platform.h`, and the `isMac` flag exposed to JS in `renderer.cc`
- `window.Pengu.isMac` and any JS branching on it in the preload layer
- Mac key-combo handling in `browser/keyboard.cc` (`Cmd+Alt+I` etc.), keeping the Windows bindings
- The `Effect` API's mac path (`applyWindowEffectMac`, the whole `NSVisualEffectMaterial` table in `preload/api/Effect.ts`) — keep only `applyWindowEffectWin` and the Win11 mica/acrylic tables
- The macOS job from the CI workflow

**Consequence, accepted:** upstream fixes can no longer be `git merge`d cleanly; they become manual ports. Given how often Riot breaks the injection path, budget for reading upstream's commits periodically rather than expecting automatic merges.

---

## 3. Layer 2 — `launcher/` (Tauri desktop app)

Upstream's is Tauri 1 + SolidJS + Tailwind, with system tray, dialogs, and filesystem write access. Ours takes on more: it is also the standalone companion window.

Responsibilities:
- Install / uninstall the injection hook — Windows registry work (IFEO) plus placing the proxied DLL next to the client. **This is the piece that needs elevation and breaks most often across OS updates.**
- Detect the League install path and its CEF version
- Manage the plugins folder; enable/disable individual plugins (upstream hashes disabled plugin paths with FNV-1a into a `disabledPlugins` string — see `preload/loader.ts`)
- Self-update check against our own GitHub releases
- **New in this fork:** host the standalone companion UI (same Vue components as the injected app, different data adapter — §5)

---

## 4. Layer 3 — `app/` (the companion, injected)

### 4.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Type safety against an undocumented, unstable API surface |
| Framework | Vue 3 (Composition API) | Reactive UI, small runtime footprint inside an injected process |
| Build | Vite | HMR, native ESM/CSS/asset resolution |
| State | Pinia | Official Vue store, TS-first |
| Data fetching / caching | `@pinia/colada` | Caching, staleTime, invalidation — replaces hand-rolled cache modules |
| LCU events | Native `socket.observe()` from our own core | Core owns one shared WebSocket with a subscription queue |
| Runtime validation | Zod | Guards against endpoint shape changes between patches |
| Routing | Vue Router (`createMemoryHistory`) | Internal navigation without touching the client's own router |
| Forms | vee-validate + Zod resolver | Settings screens, reusing the same schemas |
| Tooltips | floating-vue | Hover stat cards |
| i18n | vue-i18n | Multi-language UI |
| Styling | Tailwind (prefixed) + SCSS | Utilities for layout; SCSS for animations, mixins, theming |
| Dev tooling | vite-plugin-vue-devtools | In-page panel — works inside CEF (the browser extension does not) |

### 4.2 Entry contract (verified in upstream `plugins/src/preload/loader.ts`)

```ts
const initContext = { rcp, socket };            // ← exactly this
if (pluginName) initContext.meta = { name: pluginName };
await plugin.init(initContext);
// load() is registered on the browser's native 'load' event
```

Facts corrected against real source rather than secondary docs:
- **No `context.fs`** exists. Persistence is `window.DataStore` only.
- **No 15-second collective init budget** exists — plugins load via a plain `Promise.all`, no timeout race. A fast `init()` is good practice, not an enforced cutoff.
- **No public Command Bar registration API** for third-party plugins — upstream's is a hardcoded internal command list. In our own fork we *can* add one, since we own the preload layer.

### 4.3 Persistence (`window.DataStore`, from `core/src/renderer/v8_datastore.cc`)

Backed by a single JSON file (`loader_dir()/datastore`), XOR-obscured with a fixed key — **obfuscation, not encryption; never store anything sensitive**. The JS side keeps one in-memory `Map` shared by all plugins, and **`commit()` re-serializes the entire store on every `.set()`**:

```ts
function commit() {
  const object = Object.fromEntries(data_);      // whole store, all plugins
  native.SaveDataStore(JSON.stringify(object));
}
```

Rules: namespace all keys per plugin; keep values small (settings and CSS profiles are fine, full match-history caches are not); debounce writes. Query caches stay in memory for the session.

**Fork opportunity:** since we own `v8_datastore.cc`, we add a properly scoped per-plugin store and a real file API — **beside** `DataStore`, never replacing it (§9.2). Upstream's global `DataStore` stays byte-compatible so existing plugins keep working; ours lives under `context.ext`.

### 4.4 Folder structure — hybrid: type-first, function-grouped

```
app/
├── manifest.yml                  # our equivalent of pengu.yml
├── index.ts                      # init(context) / load()
├── vite.config.ts
├── tailwind.config.ts
└── src/
    ├── main.ts                   # Vue bootstrap — mounted only inside load()
    ├── App.vue
    ├── router/index.ts           # createMemoryHistory
    ├── components/
    │   ├── matches/              # MatchHistoryTable, MatchScoreboard, PatchFilter
    │   ├── champions/            # ChampionDeepDive, ChampionTooltip, BuildSuggestions
    │   ├── summoner/             # SummonerCard, PlayerLookup
    │   ├── settings/             # SettingsForm
    │   └── shared/               # AppWindow, TabBar, Toast
    ├── stores/                   # summoner, matches, settings, ui
    ├── composables/
    │   ├── useLcuSocket.ts       # reactive wrapper over socket.observe()
    │   ├── useLcuRest.ts
    │   ├── useNative.ts          # our core's native bridge
    │   └── useDataStore.ts       # namespaced persistence
    ├── services/
    │   ├── lcu/                  # endpoints.ts, schemas.ts, client.ts
    │   ├── sgp/                  # cross-player lookup (§6)
    │   ├── queries/              # @pinia/colada definitions
    │   └── patch/versionGuard.ts
    ├── types/
    ├── styles/
    └── locales/
```

### 4.5 Core patterns

**Reactive socket** — the core exposes one shared WebSocket with a subscription queue, so the composable stays thin:
```ts
function useLcuEvent<T>(api: string) {
  const data = ref<T>()
  let sub: { disconnect(): void }
  onMounted(() => { sub = socket.observe(api, e => { data.value = e.data }) })
  onUnmounted(() => sub?.disconnect())
  return data
}
```

**Module lifecycle with per-module isolation** (pattern proven in Snooze-Manager) — a registry of features, each with `init`/`load`/`unload`, each wrapped individually so one failure can't take down the rest:
```ts
for (const [id, module] of MODULES) {
  try { await module[method]?.(...args) }
  catch (e) { log.error(`${id}.${method} failed:`, e) }
}
```

**Runtime validation** — every response `safeParse`d through a Zod schema, so a patch that renames a field fails loudly instead of silently corrupting state.

**Passive during matches** — per §0, unmount and go quiet on `InProgress`.

**Kill-switch** — if any feature ever auto-acts, register it with a global panic hotkey that cancels every registered action at once (the established idiom in this ecosystem for that risk category).

---

## 5. Shared UI Between Injected App and Launcher

Both surfaces are web renderers (CEF for the injected app, WebView2/WebKit for Tauri), so **the same Vue components run in both**. Only the data adapter differs:

```
packages/
├── ui/           # pure Vue components, zero direct API calls
├── app-injected/ # adapter: fetch() against LCU + socket.observe()
└── app-desktop/  # adapter: Tauri invoke() → Rust
```

This is the payoff that makes the fork worthwhile. Keep components free of transport concerns from day one — retrofitting that separation later is the expensive path.

---

## 6. Data Sources — both, not either/or

| Need | Source | Scope |
|---|---|---|
| Patch version | `GET /lol-patch/v1/game-version` | local |
| Region/locale | `GET //riotclient/region-locale` | local |
| Current summoner | `GET /lol-summoner/v1/current-summoner` | local |
| Own match history | LCU match-history endpoints | own account |
| **Any player's history** | **SGP direct access** (§6.1) | any PUUID |
| Live phase changes | `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase` | local |

The router carries both cleanly:
```ts
routes: [
  { path: '/',               component: MyStats },      // LCU-only
  { path: '/lookup/:riotId', component: PlayerLookup }, // SGP
]
```

### 6.1 SGP direct access — capability and caveat

Takes the entitlements token from the already-authenticated client session and queries Riot's own stats backend directly:

```ts
const { accessToken, sgpBase } = await getSgpContext(region);
fetch(`${sgpBase}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

No developer API key, no approval, no official rate limit. This is how existing plugins implement "investigator" features.

**Two real caveats:** it is an undocumented internal endpoint (more volatile than the LCU proxy, can change without notice — hence the Zod guard), and cross-player lookup is a **policy** question under Riot's acceptable-use rules independent of any anti-cheat consideration (§0). Riot's published policy does permit aggregate stats and personal training tools; scouting-flavored features are where the line sits.

**What none of this provides:** global aggregate winrates (op.gg-style). That needs a full ingestion pipeline against the official Match-V5 API — a separate infrastructure project, not a client feature.

---

## 7. Theming — Native, Not a Plugin

**Decided:** theming is a first-class capability of the loader itself, built into the preload runtime, not something the user installs as a plugin. It ships in the box, is configured from the launcher, and is available to every user without them assembling anything.

### 7.1 Why native changes the design

As a plugin, theming has to patch `Element.prototype.attachShadow` from *inside* the page, after the client has already started creating shadow roots — which is why the plugin approach needs a retroactive DOM walk to catch roots created before it loaded, plus a delayed re-apply to work around the CEF keyframes startup bug.

In the preload layer we run **before any of the client's own scripts**, so the patch is in place before the first shadow root exists. No retroactive scan, no timing workaround, no race.

### 7.2 The mechanism

The client is built from Web Components with Shadow DOM, so a `<style>` in `document.head` never reaches inside one. One shared constructable stylesheet, adopted by every root as it's created:

```ts
// preload/theming/index.ts — installed during preload, before client scripts run
const globalSheet = new CSSStyleSheet()
const originalAttachShadow = Element.prototype.attachShadow

Element.prototype.attachShadow = function (init) {
  const root = originalAttachShadow.call(this, init)
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, globalSheet]
  return root
}

export function applyTheme(css: string) {
  globalSheet.replaceSync(css)   // every adopting root repaints at once
}
```

Details that still apply, all verified against a working implementation:
- `@import` and `@font-face` misbehave inside constructable stylesheets under CEF — extract them into a normal `<style>` in the main document.
- Iframes are separate documents, not shadow roots: they need their own injected `<style>`, a `MutationObserver` for iframes added later, and re-injection on each iframe's `load` event.
- CSS profiles (a few KB of text) persist fine in the datastore.
- Import/export via `Blob` + `<a download>` and a hidden `<input type="file">` — no native dialog needed.

### 7.3 What "native" buys us beyond the injection timing

- **Themes are a loader concept, not a plugin folder.** Install, switch, preview and remove from the launcher UI (§3) — same place the user already manages everything else.
- **Applied before first paint.** A theme set as active is live from the client's first frame, with none of the flash-of-default-theme a plugin-based approach has.
- **Exposed to plugins as an API**, not competed with: `context.ext.theme.apply(css)` / `.getActive()`, so a plugin can contribute or switch themes without re-implementing the shadow-root machinery — and without two competing `attachShadow` patches fighting each other, which is exactly what would happen if theming stayed a plugin and two users installed two theming plugins.
- **Upstream themes still work.** Upstream ships themes as plugins (`theme: true` in its manifest); we keep loading those unchanged (§9.2) and let the native engine own the application path.

Implementation lives in the preload layer (`core`-side JS bundle), with the launcher UI for profile management and the `context.ext.theme` API surface added alongside the other extensions in §9.2.

---

## 8. Build Order

1. **Fork and build upstream unmodified.** Get `core.dll` plus the launcher compiling and injecting on your own machine before changing anything. Highest-risk step to discover problems in — do it first, with nothing of ours on top.
2. **Strip macOS** per §2.6, then confirm the Windows build still compiles and injects. Doing this before the rebrand keeps the two changes independently verifiable.
3. **Rebrand the core.** Globals, virtual scheme, product names, `LICENSE` with the upstream notice retained.
4. **Extend the runtime API additively** (§9.2): `context.ext.store`, `context.ext.fs`, `context.ext.commands`, `context.ext.theme` — upstream's contract left untouched so existing plugins still run.
5. **Build the native theming engine** (§7) into the preload layer, plus its profile-management UI in the launcher. Doing it here, before the companion app, means the `attachShadow` patch is settled in the preload runtime rather than retrofitted later.
6. **Build `app/` against our own core.** Vue stack per §4, mocked data first.
7. **Wire real data** — LCU first, SGP second (independent of everything above).
8. **Merge launcher and standalone companion** into one Tauri app (§5).
9. **CI and releases** — adapt upstream's `build.yml` to a single Windows job; ship signed builds where possible.

**Ongoing, unavoidable maintenance:** every CEF bump in the client, every Riot Client update that changes the launch chain, every OS update touching the injection path. This is the true cost of the fork, and it does not end.

---

## 9. Decisions

### 9.1 Coexistence — resolved: exclusive
Our loader does **not** run alongside an upstream PenguLoader install. Both proxy the same system DLLs (`d3d9`/`dwrite`/`version`), so whichever one wins the load order silently breaks the other. The launcher detects an existing upstream install at startup and refuses to install until the user removes it, with a clear message naming what it found and where. Fail loudly at install time rather than producing a half-working client the user can't diagnose.

### 9.2 Plugin API — resolved: compatible, then extended
Keep upstream's plugin contract intact — same `init(context)` shape, same `{ rcp, socket, meta }`, same `window.DataStore`, same three folder layouts. Existing PenguLoader plugins run unmodified on our loader.

New capabilities are **additive only**, exposed under our own namespace so a plugin can feature-detect and degrade:

```ts
export function init(context) {
  context.rcp; context.socket; context.meta;   // upstream contract, unchanged
  if (context.ext) {                            // ours, optional
    context.ext.store   // per-plugin scoped storage, no global re-serialize
    context.ext.fs      // real scoped file API (the thing upstream's docs wrongly claimed existed)
    context.ext.commands// register into the command palette
  }
}
```

Rule going forward: never change the meaning of an existing upstream API, only add beside it. The moment we redefine `DataStore` or `socket` semantics we inherit an ecosystem of subtly broken plugins and no way to tell which.

### 9.3 Signing — resolved, with a correction

**Self-signing does not solve this.** Microsoft's own guidance is explicit that PE files must be signed with a certificate chaining to a CA in the Microsoft Trusted Root Program, and that self-signed certificates are not accepted. A self-signed binary produces the same "unknown publisher" warning as an unsigned one — it changes nothing about SmartScreen or AV heuristics. There is no free or automatic path to trusted signing.

**Azure Trusted Signing (renamed Azure Artifact Signing in 2026)** is the cheapest managed option at ~$9.99/month — no hardware token, integrates directly with GitHub Actions. **But individual developers are currently limited to the USA and Canada**, so it is not available to us from Brazil. Worth re-checking before v1 ships, since Microsoft has been expanding coverage.

**Practical path for a Brazil-based individual developer:**

| Option | Cost | Notes |
|---|---|---|
| Individual (IV) code-signing cert — Certum, Sectigo, Certera | ~$99–$216/year | Available worldwide to individuals. Requires identity validation and, since 2026, storage on a compliant HSM/token (a YubiKey 5 FIPS or a cloud KMS satisfies this). Certificate lifespans are capped at 1 year as of Feb 2026. |
| Azure Artifact Signing | ~$9.99/month | Blocked for individuals outside US/CA today — recheck later. |
| Ship unsigned | free | SmartScreen warning on every release, AV false positives likely given the injection behavior. Acceptable only for a private/early build. |

**Reputation, not just signature:** signing alone does not grant instant SmartScreen trust. Reputation accrues to a consistent publisher identity across releases, so the value compounds — which argues for signing from the first public release rather than adding it later, since switching identity resets accumulated reputation.

**Expect AV false positives regardless.** DLL proxying plus `CreateProcessW` hooking plus injection into a suspended process is, behaviorally, indistinguishable from malware to a heuristic scanner. Budget for submitting false-positive reports to major AV vendors, and document the behavior openly in the README — a signed binary from a consistent publisher with a public source repo is the strongest position available here.

### 9.4 Functional scope — resolved: client-only, nothing in-game

Every feature lives in the client shell — lobby, champ select, profile, match history, post-game. **Nothing runs while a match is in progress**, and nothing overlays or reads the game itself.

| Surface | In scope | Notes |
|---|---|---|
| Lobby / home | ✅ | Own stats, recent performance, entry point to lookup |
| Champ select | ✅ | Own history with the champion, hover stat cards |
| Profile pages | ✅ | Own profile plus lookup of any Riot ID (§6.1) |
| Match history / post-game | ✅ | Full scoreboard, per-match breakdown, patch filtering |
| **In-game (`InProgress`)** | ❌ | Fully passive per §0 — unmount UI, no fetches, no DOM work |
| Game overlay / engine data | ❌ | Never. Different process, different risk category entirely |

This isn't only a risk decision, it's also a scope simplification: no Live Client Data API, no overlay rendering on top of the game, no second process to coordinate with. The companion is a client tool.

### 9.5 Still open

*(none blocking — remaining choices are implementation-level and can be made while building)*
