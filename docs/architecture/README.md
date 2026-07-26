# Marbles 3D Architecture

Phased migration from mixin-assembled `MarblesGame` toward composable subsystems with narrow APIs and TypeScript coverage.

## Ownership map

| Concern | Canonical home | Mixin bridge (deprecated) | Notes |
|---------|----------------|---------------------------|-------|
| Entry / wiring | `src/main.js` | — | Creates state/subsystems, installs closed compatibility lists, boots `init()` |
| Grouped state | `src/game/state/` | `this.*` mirrors via `bindGameState()` | physics, abilities, level, camera, input, hud, render |
| Pure game logic | `src/game/systems/` | — | Unit-testable without Filament |
| Zones (geometry) | `src/zones/` + `zone-setup/registry.js` | `zones/methods/` primitives | See `docs/PROJECT_STRUCTURE.md` |
| Zone setup | `src/zone-setup/` | `zone-setup-methods.js` | Thin re-export only |
| Init / menus | `src/init/` | `init-methods.js` | Thin re-export only |
| Game logic | `src/game-logic/` | `game-logic-methods.js` | Thin re-export only |
| Abilities | `src/abilities/` + `src/game/systems/ability-system.js` | `ability-methods.js` | Registry pattern — see [abilities.md](./abilities.md) |
| Game loop | `src/game-loop/` | `game-loop-*.js` at `src/` root | **Phase A complete** — single folder |
| Input | `src/game/systems/input-system.js` | `input-methods.js` | Phase B — `InputSystem` ✅ |
| Physics factory | `src/game/systems/physics-world.js` | `physics-factory-methods.js` | Phase B — `PhysicsWorld` ✅ |
| Physics worker | `src/game/physics-worker/` + `physics-backend.js` | — | Tutorial spike — see [physics-worker.md](./physics-worker.md) |
| Marble spawn | `src/game/systems/marble-registry.js` | `marble-management-methods.js` | Phase B — `MarbleRegistry` ✅ |
| Render sync | `src/game/systems/render-pipeline.js` | `src/game-loop/sync.js` runtime slice | `RenderPipeline` owns frame order, transform sync, draw, culling path, and static flush |
| HUD | `src/game/systems/hud-controller.js` + `hud` state | `src/hud-manager.js`, `game-loop/hud-tick.js` | `HudController` owns HUD DOM, cooldowns, goal FX, and desync display |
| Level lifecycle | `src/game/systems/level-loader.js` | `src/init/level-loader.js`, `src/init/cleanup.js` runtime slices | Injected physics, marble, asset, and catalog dependencies |
| Levels catalog | `assets/manifest.json` + `src/levels/catalog.js` | `src/levels.js` (dev only) | JSON production path — see [level-pipeline.md](./level-pipeline.md); chapters — [campaign.md](./campaign.md) |
| Map editor | `src/editor/` | — | `?editor=1` — see [map-editor.md](./map-editor.md) |

### `src/game-loop/` layout (canonical)

| File | Responsibility |
|------|----------------|
| `loop.js` | `loop()` — rAF driver |
| `logic.js` | `updateGameState()` — pre-physics ability/state tick |
| `frame-input.js` | Shortcuts, movement impulses, magnet |
| `camera.js` | Camera matrices, DoF |
| `dynamics-tick.js` | Kinematic platforms, collectibles |
| `hud-tick.js` | Legacy cooldown implementation invoked only by `HudController` |
| `effects-tick.js` | Black holes, missiles, bombs |
| `finalize-frame.js` | Single `HudController.updateFrame()` entry + perf accounting |
| `sync.js` | Transform/draw runtime slice owned by `RenderPipeline` |
| `speed-lines.js` | Motion overlay |
| `helpers.js` | Shared transform/color helpers |
| `index.js` | Closed compatibility method list for non-composed frame slices |

See **[game-loop.md](./game-loop.md)** for the live import graph and per-frame call order.

Root `game-loop-*-methods.js` shims were **removed** July 2026.

## Phased plan

### Phase A — Single home per concern ✅ (in progress)

- [x] `game-loop/` owns update + render + sync (no parallel fat `*-methods.js`)
- [x] `zone-setup/` already canonical (prior cleanup)
- [x] `abilities/`, `game-logic/`, `init/` use thin root re-exports only

### Phase B — Composition ✅

- [x] Constructor state grouped in `src/game/state/*`
- [x] `bindGameState()` mirrors onto `this.*` for existing mixins
- [x] Extract `PhysicsWorld`, `InputSystem`, `MarbleRegistry` as composed classes (`main.js` delegates; mixin apply removed for these three)
- [x] Extract `RenderPipeline`, `HudController`, `LevelLoader` as constructed classes with explicit dependencies
- [x] Delegate composed APIs from `MarblesGame`; remaining legacy folders use closed, named compatibility lists

#### Phase B composition decision (July 2026)

- `LevelLoader` owns level lookup/load/clear and receives `PhysicsWorld`, `MarbleRegistry`, `AssetRegistry`, and the catalog lookup. Browser-heavy runtime bodies remain injected adapters until Phase C.
- `RenderPipeline` remains main-thread-only and owns frame ordering, transform sync, Filament/simple-WebGL draw, culling orchestration, and static batch flush delegation.
- `HudController` is the single owner for ability DOM, legacy cooldown bars, goal FX, and multiplayer drift presentation. `finalize-frame.js` calls one `updateFrame` entry.
- Zone, setup, game-logic, ability, init, and residual game-loop compatibility methods are installed from explicit allowlists. Prototype enumeration and `applyLegacyMixins` are no longer in the active entry path.

### Phase C — TypeScript (in progress)

- [x] Pilot: `src/math.ts` + `src/types/geometry.ts` (imported via `math.js` shim)
- [x] `@ts-check` on `wasm-bridge.js` + `src/game/state/*` with `types/game-state.ts`
- [x] Pure systems → `.ts`: `ability-cooldown`, `trick-scoring`, `campaign-progress`, `replay-codec` (`.js` shims)
- [ ] Add `src/levels/catalog.js` + `src/types/map.ts` + `src/abilities/registry.js` to `include`
- [ ] Widen to remaining pure `game/systems/*` modules
- [ ] Widen `tsconfig` `include` as each slice passes `npm run typecheck`

## Language & archived code

See **[language-strategy.md](./language-strategy.md)** for:

- When to use C++ vs JavaScript vs TypeScript
- UI stack (vanilla HUD, no in-game React)
- Decisions on `orphan-react-stack` and `experimental-wasm-renderer`

## Mixin deprecation

Legacy folders use closed `install*Methods(MarblesGame)` allowlists at load time. **Do not add new mixins or prototype enumeration.** New behavior should go in:

1. `src/game/systems/` (pure logic), or
2. `src/<concern>/` folder module with a reviewed entry in that folder's closed installer

The installers are compatibility boundaries only; composed subsystem APIs use `delegateTo` in `main.js`.

## Testing without Filament

Pure modules under `src/game/systems/` are runnable from Node:

```bash
node tests/test_game_systems.js
```

Examples: `ability-cooldown.js`, `trick-scoring.js`, `physics-world-pure.js`, `input-target-lock.js`. Expand this set as logic is extracted from mixins.

## Cross-cutting coupling today

Mixins communicate via implicit `this.*` on `MarblesGame`. Prefer:

- **Reads**: `this.physics.marbles` or `this.marbles` (same reference after `bindGameState`)
- **New code**: use `this.state.<subsystem>` namespace
- **Avoid**: new flat `this.foo` fields in `main.js` — add to the appropriate `game/state/*.js` factory

## Related docs

- [language-strategy.md](./language-strategy.md) — language boundaries, C++ rules, archived React/WebGPU
- [physics-worker.md](./physics-worker.md) — SharedArrayBuffer physics worker (120 Hz spike)
- [product-epic.md](./product-epic.md) — 12–18 month north-star (workshop, ranked, hero content)
- [workshop-platform.md](./workshop-platform.md) — Workshop UGC data model + moderation ADR
- [level-pipeline.md](./level-pipeline.md) — JSON vs code level inventory and migration policy
- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) — repo layout and entry graph
- [CONTRIBUTING.md](../CONTRIBUTING.md) — adding zones and content
