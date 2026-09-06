## Riot Loader — desktop launcher

Tauri v1 + Vue 3 desktop app: installs/removes the injection hook, manages
plugins on disk, and hosts loader-level settings (client tweaks, activation
mode, League/plugins directory).

```
loader/
  |__ src/          # Vue 3 frontend (pages, components, lib/)
  |__ src-tauri/     # Rust backend (Tauri commands, Windows activation)
```

The in-client UI and preload runtime that get injected into the League
client live in `../plugins/`. The first-party companion app (match history,
summoner lookup, settings) lives in `../app/` and loads as a plugin inside
the client — it is a separate workspace from this one.

### Dev

```
pnpm install
pnpm dev:loader
```

Requires the core DLL (`core.dll`) to already be built (see the repo root
`README.md` for the full build order) if you intend to activate the hook
from a dev build.
