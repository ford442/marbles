# Project Structure

This document describes the **active** Marbles 3D tree and how it is organized after the July 2026 runtime cleanup.

## Runtime entry graph

The shipped browser game has a single entry:

```
index.html
  └── <script type="module" src="/src/main.js">
        └── static ES module imports (Vite bundle)
```

Everything under `src/` that ships in `npm run build` must be reachable from `src/main.js` through static `import` / `export` statements. Files outside that graph were moved to [`docs/backups/`](backups/README.md).

### Core modules (from `main.js`)

| Area | Key files |
|------|-----------|
| Initialization | `init-methods.js`, `init/` |
| Input | `input-methods.js` |
| Zones | `zone-setup-methods.js`, `zone-setup/`, `zones/*.js`, legacy `*_zone.js` factories |
| Physics | `physics-factory-methods.js`, `@dimforge/rapier3d-compat` |
| Marbles | `marble-management-methods.js`, `marbles_data.js` |
| Game logic | `game-logic-methods.js`, `game-logic/` |
| Abilities | `ability-methods.js`, `abilities/` |
| Loop | `game-loop/` (`loop.js`, `logic.js`, `render.js`, `sync.js`, …) |
| Rendering | `material-system.js`, `rendering/`, `lighting-system.js`, `particle-system.js` |
| HUD / perf | `hud-manager.js`, `perf-monitor.js`, `culling-manager.js`, `auto-quality-governor.js` |
| Levels | `levels/catalog.js`, `assets/manifest.json`, `assets/maps/*.json`; dev-only `levels.js` |
| WASM helpers | `wasm-bridge.js` → `public/wasm/marble_physics.{js,wasm}` |

### Zone loading pattern

- **Production levels**: `assets/manifest.json` → `AssetRegistry` → `src/levels/catalog.js` (**14 shipped**; see [architecture/level-pipeline.md](architecture/level-pipeline.md)).
- **Dev-only levels**: `src/levels.js` (`DEV_LEVELS`, ~58 entries) merged when `?devLevels=1` or `?dev=1` (~68 unique ids total with dev flag).
- **Registration**: `src/zone-setup/registry.js` maps each `zone.type` to a handler (single source of truth).
- **Dispatch**: `src/zone-setup/core.js` calls `dispatchZone()` — no duplicate switch statements.
- **Factories**: `src/zones/<kebab-name>.js` export `create*Zone(game, offset)`; barrel re-export in `src/zones/index.js`.
- **Primitives**: `floor`, `track`, `goal`, etc. use methods from `src/zones/methods/creation.js` via `BUILTIN_ZONE_HANDLERS`.
- **Setup mixins**: `applyZoneSetupMethods` → `zone-setup/{core,assets,environment,grapple}.js` only (`zone-setup-methods.js` is a thin re-export).

### Marble data

Premium marbles formerly in `marble_draft.js` are inlined at the top of `src/marbles_data.js` as `premiumMarbles`. There is no separate draft module on the runtime path.

## Root level

| File | Purpose |
|------|---------|
| `package.json` | Dependencies: Filament, Rapier, Vite. **No React.** |
| `vite.config.js` | COOP/COEP headers, WASM assets |
| `tsconfig.json` | Strict TypeScript; selective `checkJs` on pilot modules — see `docs/architecture/language-strategy.md` |
| `index.html` | Game shell, HUD markup, loads `src/main.js` |

## Directory layout

### `/src` — active game source

```
src/
├── main.js                 # MarblesGame + mixin wiring
├── *-methods.js            # Game system mixins
├── levels.js               # Declarative level catalog
├── marbles_data.js         # Marble definitions (incl. premium marbles)
├── zones/                  # All zone factories (create*Zone)
│   ├── index.js            # Barrel exports
│   ├── methods/            # Shared zone utilities + built-in primitives
│   └── <kebab-name>.js     # Themed / procedural zone builders
├── zone-setup/             # Zone setup mixins + registry
│   ├── registry.js         # zone.type → handler map (single registration)
│   ├── core.js             # createZone → dispatchZone
│   ├── assets.js, environment.js, grapple.js
│   └── index.js            # applyZoneSetupMethods
├── zone-setup-methods.js   # Thin re-export for main.js compatibility
├── game-logic/             # Scoring, checkpoints, collectibles
├── game/state/             # Grouped constructor state (physics, abilities, level, …)
├── game/systems/           # Pure logic testable without Filament
├── game-loop/              # loop, logic, camera, sync, render orchestrator
├── abilities/              # Individual ability implementations
├── init/                   # Init sub-steps (Filament, menus, settings)
├── rendering/              # Environment, post-FX, debug renderer
├── types/                  # Shared TS types (geometry, …)
├── math.ts                 # Typed pilot: quat/mat4 helpers
├── math.js                 # Shim re-export for existing JS imports
├── zones/methods/          # Shared zone utilities
└── wasm-bridge.js          # Optional C++ physics WASM façade
```

**Not in `src/` anymore** (archived):

- React/TSX UI (`components/`, `sequencer/`, `importers/`) → `docs/backups/orphan-react-stack/`
- WebGPU WASM renderer experiment → `docs/backups/experimental-wasm-renderer/`
- `*.broken`, `*.orig`, `*.restored`, `*.backup`, `*_draft*.js` → `docs/backups/game-runtime-drafts/`
- Unused duplicate zones and unwired modules → `docs/backups/unused-game-modules/`

### `/assets` — game data

JSON maps, marbles, sounds, schemas, and `manifest.json`. Loaded at runtime via fetch / manifest, not via the JS import graph from `main.js`.

### `/docs` — documentation

- `PROJECT_STRUCTURE.md` (this file)
- `AGENTS.md`, `CONTRIBUTING.md`, guides, plans
- `architecture/` — ownership map, phased migration (`README.md`), language boundaries (`language-strategy.md`), game loop graph (`game-loop.md`)
- `backups/` — archived source (see `backups/README.md`)

### `/backend` — Python API

FastAPI storage service under `backend/storage/`. The old root-level `storage/` mirror was archived to `docs/backups/root-leftovers/`.

### `/tests` — integration / smoke tests

Node scripts that import **runtime** modules (e.g. `particle-system.js`, `marbles_data.js`). They do not import the archived React stack.

### `/public` — static assets

Filament binaries, materials, WASM physics output.

### `/wasm` — C++ physics module (optional)

Built with `npm run build:wasm`; output copied to `public/wasm/`.

## Build & test expectations

```bash
npm install
npm run build    # build:wasm + vite build — must not resolve docs/backups or React
npm run dev      # http://localhost:5173
```

Future unit tests should target the `main.js` import graph and live under `tests/` or a configured runner that does **not** add React unless the orphan stack is revived as an optional entry (e.g. separate `sequencer.html`).

## Import conventions

- ES modules with explicit `.js` extensions in relative imports
- Rapier: `import RAPIER from '@dimforge/rapier3d-compat'`
- Filament: global from `index.html` `<script src="./filament.js">`, accessed as `this.Filament` after init

## Auditing orphans

After adding files under `src/`, verify they are imported from the entry graph. The snippet in [`docs/backups/README.md`](backups/README.md) lists all modules reachable from `main.js`.
