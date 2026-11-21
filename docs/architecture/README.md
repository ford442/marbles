# Marbles 3D Architecture

`MarblesGame` is assembled by composition: feature slices and composed systems, each typed against a narrow `*Host` interface. The mixin era (Phases A–C) is over; Phase D removed the last `install*Methods` installer and brought `src/` to 100% type-checked.

## Ownership map

| Concern | Canonical home | Runtime slice / adapter | Notes |
|---------|----------------|---------------------------|-------|
| Entry / wiring | `src/main.js` | — | Creates state, calls `createRuntime(host)` (`src/game/create-runtime.ts`, typed against `GameHost` in `src/types/game-host.ts`), composes `GAME_SLICES`, forwards explicit method lists, boots `init()`. The whole object is typed as `MarblesGameHost` (`src/types/marbles-game-host.ts`) |
| Grouped state | `src/game/state/` | `game.*` mirrors via `bindGameState()` | physics, abilities, level, camera, input, hud, render |
| Pure game logic | `src/game/systems/` | — | Unit-testable without Filament |
| Zones (geometry) | `src/zones/` + `zone-setup/registry.js` | `zones/methods/` slices (`ZONE_METHOD_SLICES`) | Factories take a `ZoneBuildHost` (`src/types/zone-host.ts`); see `docs/PROJECT_STRUCTURE.md` |
| Zone setup | `src/zone-setup/` | — (`zone-setup-methods.js` deleted) | `ZONE_SETUP_SLICES` in `zone-setup/index.ts` |
| Init / menus | `src/init/` | — (`init-methods.js` deleted) | `INIT_SLICES` in `init/index.ts` |
| Game logic | `src/game-logic/` | — (`game-logic-methods.js` deleted) | `GAME_LOGIC_SLICES` in `game-logic/index.ts` |
| Abilities | `src/abilities/` + `src/game/systems/ability-system.ts` | — (`ability-methods.js` deleted) | Registry pattern + `ABILITY_SLICES` — see [abilities.md](./abilities.md) |
| Game loop | `src/game-loop/` | — | `GAME_LOOP_SLICES` in `game-loop/index.ts` |
| Input | `src/game/systems/input-system.ts` | — | Phase B — `InputSystem` ✅ |
| Physics factory | `src/game/systems/physics-world.ts` | — | Phase B — `PhysicsWorld` ✅ |
| Physics worker | `src/game/physics-worker/` + `src/game/systems/physics-backend.ts` | — | Production opt-in — see [physics-worker.md](./physics-worker.md) |
| Marble spawn | `src/game/systems/marble-registry.js` | — (`marble-management-methods.js` deleted) | Phase B — `MarbleRegistry` ✅ |
| Render sync | `src/game/systems/render-pipeline.ts` | `src/game-loop/sync.ts` runtime slice | `RenderPipeline` owns frame order, transform sync, draw, culling path, and static flush |
| HUD | `src/game/systems/hud-controller.ts` + `hud` state | `src/hud-manager.ts` (`HudHost`), `game-loop/hud-tick.js` | `HudController` owns HUD DOM, cooldowns, goal FX, and desync display |
| Level lifecycle | `src/game/systems/level-loader.ts` | `src/init/level-loader.js`, `src/init/cleanup.js` runtime slices | Injected physics, marble, asset, and catalog dependencies |
| Levels catalog | `assets/manifest.json` + `src/levels/catalog.js` | `src/levels.ts` (dev only) | JSON production path — see [level-pipeline.md](./level-pipeline.md); chapters — [campaign.md](./campaign.md) |
| Map editor | `src/editor/` | — | `?editor=1` — see [map-editor.md](./map-editor.md) |

### `src/game-loop/` layout (canonical)

| File | Responsibility |
|------|----------------|
| `loop.ts` | `loop()` — rAF driver |
| `logic.js` (`@ts-check`) | `updateGameState()` — pre-physics ability/state tick |
| `frame-input.ts` | Shortcuts, movement impulses, magnet |
| `camera.ts` | Camera matrices, DoF |
| `dynamics-tick.js` (`@ts-check`) | Kinematic platforms, collectibles |
| `hud-tick.js` (`@ts-check`) | Legacy cooldown implementation invoked only by `HudController` |
| `effects-tick.ts` | Black holes, missiles, bombs |
| `finalize-frame.js` (`@ts-check`) | Single `HudController.updateFrame()` entry + perf accounting |
| `sync.ts` | Transform/draw runtime slice owned by `RenderPipeline` |
| `speed-lines.js` (`@ts-check`) | Motion overlay |
| `helpers.ts` | Shared transform/color helpers |
| `repel-pulse.ts` | Repel-pulse ability effect |
| `index.ts` | `GAME_LOOP_SLICES` + `GameLoopSlicesHost` |

See **[game-loop.md](./game-loop.md)** for the live import graph and per-frame call order.

Root `game-loop-*-methods.js` shims were **removed** July 2026; the remaining root `*-methods.js` shims (`ability-`, `init-`, `game-logic-`, `zone-setup-`, `marble-management-`, `physics-factory-`, `input-methods.js`) were **removed** September 2026.

## Phased plan

### Phase A — Single home per concern ✅

- [x] `game-loop/` owns update + render + sync (no parallel fat `*-methods.js`)
- [x] `zone-setup/` already canonical (prior cleanup)
- [x] `abilities/`, `game-logic/`, `init/`, `zone-setup/` expose closed installers from their own `index.js` (root re-export shims deleted)

### Phase B — Composition ✅

- [x] Constructor state grouped in `src/game/state/*`
- [x] `bindGameState()` mirrors onto `game.*` for slices
- [x] Extract `PhysicsWorld`, `InputSystem`, `MarbleRegistry` as composed classes (`main.js` delegates; mixin apply removed for these three)
- [x] Extract `RenderPipeline`, `HudController`, `LevelLoader` as constructed classes with explicit dependencies
- [x] Delegate composed APIs from `MarblesGame`; remaining legacy folders use closed, named compatibility lists

#### Phase B composition decision (July 2026)

- `LevelLoader` owns level lookup/load/clear and receives `PhysicsWorld`, `MarbleRegistry`, `AssetRegistry`, and the catalog lookup. Browser-heavy runtime bodies remain injected adapters (typed as `LevelRuntime` / `LevelCleanupRuntime`).
- `RenderPipeline` remains main-thread-only and owns frame ordering, transform sync, Filament/simple-WebGL draw, culling orchestration, and static batch flush delegation.
- `HudController` is the single owner for ability DOM, legacy cooldown bars, goal FX, and multiplayer drift presentation. `finalize-frame.js` calls one `updateFrame` entry.
- Zone, setup, game-logic, ability, init, and residual game-loop methods were installed from explicit allowlists (replaced by composed slices in Phase D).

### Phase C — TypeScript ✅

- [x] Pilot: `src/math.ts` + `src/types/geometry.ts` (imported directly; the `math.js` shim is gone)
- [x] `@ts-check` on `wasm-bridge.js` + `src/game/state/*` with `types/game-state.ts`; `wasm-bridge.js` is in `tsconfig.json` `include`
- [x] Pure systems → `.ts`: `ability-cooldown`, `trick-scoring`, `campaign-progress`, `replay-codec`, `physics-world-pure`, `physics-backend-pure`, `input-target-lock`
- [x] `src/levels/catalog.js`, `src/levels/campaign.js`, `src/types/map.ts`, `src/abilities/registry.js` in `include`
- [x] Composed systems → `.ts`: `physics-world`, `input-system`, `render-pipeline`, `level-loader`, `hud-controller`, `ability-system`, `physics-backend`
- [x] `game-loop/helpers.ts`, `game-loop/loop.ts`; `HUDManager` typed against a narrow `HudHost` (no `game: any`)
- [x] `@webgpu/types` (devDependency) — `boot-probe.js` and `particle-backend.js` are `@ts-check`ed with real `GPUDevice` / `GPUCanvasContext`; `webgpu/**` and `gpu-chores/**` are in `include`
- [x] Remaining `game-loop/*` slices (including `sync.ts`), `webgpu/**`, `gpu-chores/**` and the zone factories — done in Phase D

### Phase D — Compose every slice; type all of `src/` ✅ (Nov 2026)

- [x] Every `install*Methods` installer became a list of slice classes (`*_SLICES`, built with `defineSlice`); `method-installer.js` is deleted. `composeSlices` builds one instance per slice at `game[key]` (keys end in `Slice`) and `forwardSliceMethods` defines the `game.foo()` forwarders. Duplicate names, missing methods and key collisions throw at startup.
- [x] Each slice directory exports a typed `*SlicesHost`. `GameHost` (systems built by `create-runtime.ts`) plus all of them form `MarblesGameHost`; `create-runtime.types-test.ts` fails the typecheck if any member collapses to `never` or an index signature appears.
- [x] Shared contracts instead of per-host re-declarations: `EngineContext` (`src/types/engine-context.ts`), `FrameState`, `ZoneBuildHost`, `GameSettings`.
- [x] `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `erasableSyntaxOnly`; `include` covers all of `src/` and `scripts/level-lab.mjs`. `npm run typecheck:coverage` ratchets typed files, typed LOC share and suppression count in CI.
- [x] Map / marble / sound types generated from `assets/schemas/*.json` (`npm run gen:schema-types`), shared by `primitives.ts`, the editor and the level lab.

See [language-strategy.md](./language-strategy.md) for the typing rules.

## Language & archived code

See **[language-strategy.md](./language-strategy.md)** for:

- When to use C++ vs JavaScript vs TypeScript
- UI stack (vanilla HUD, no in-game React)
- Decisions on `orphan-react-stack` and `experimental-wasm-renderer`

## Adding behaviour (no mixins)

There are no mixins, installers or prototype enumeration. New behaviour goes in:

1. `src/game/systems/` — pure logic, or a composed system built by `create-runtime.ts` with its own `*Host`; or
2. a slice class in `src/<concern>/` that holds the game as `this.game: XxxHost`, listed with `defineSlice(key, Class, [methods])` in that folder's `*_SLICES`. Only listed methods are forwarded onto the game.

A slice's host is an intersection of `Pick`s from the shared contracts (`EngineContext`, `FrameState`, other slices' classes), never a fresh re-declaration, so `MarblesGameHost` stays consistent.

## Testing without Filament

Pure modules under `src/game/systems/` are runnable from Node:

```bash
node tests/test_game_systems.js
```

Examples: `ability-cooldown.ts`, `trick-scoring.ts`, `physics-world-pure.ts`, `input-target-lock.ts`. Expand this set as logic is extracted from slices.

## Cross-cutting coupling today

Slices communicate through `this.game.*`, typed by their host. Prefer:

- **Reads**: `game.physics.marbles` or `game.marbles` (same reference after `bindGameState`)
- **New code**: use the `game.state.<subsystem>` namespace
- **Avoid**: new flat `this.foo` fields in `main.js` — add to the appropriate `game/state/*.js` factory

## Related docs

- [language-strategy.md](./language-strategy.md) — language boundaries, C++ rules, archived React/WebGPU
- [physics-worker.md](./physics-worker.md) — SharedArrayBuffer physics worker (120 Hz spike)
- [product-epic.md](./product-epic.md) — 12–18 month north-star (workshop, ranked, hero content)
- [workshop-platform.md](./workshop-platform.md) — Workshop UGC data model + moderation ADR
- [level-pipeline.md](./level-pipeline.md) — JSON vs code level inventory and migration policy
- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) — repo layout and entry graph
- [CONTRIBUTING.md](../CONTRIBUTING.md) — adding zones and content
