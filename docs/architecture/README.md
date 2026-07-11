# Marbles 3D Architecture

Phased migration from mixin-assembled `MarblesGame` toward composable subsystems with narrow APIs and TypeScript coverage.

## Ownership map

| Concern | Canonical home | Mixin bridge (deprecated) | Notes |
|---------|----------------|---------------------------|-------|
| Entry / wiring | `src/main.js` | — | Creates state, applies mixins, boots `init()` |
| Grouped state | `src/game/state/` | `this.*` mirrors via `bindGameState()` | physics, abilities, level, camera, input, hud, render |
| Pure game logic | `src/game/systems/` | — | Unit-testable without Filament |
| Zones (geometry) | `src/zones/` + `zone-setup/registry.js` | `zones/methods/` primitives | See `docs/PROJECT_STRUCTURE.md` |
| Zone setup | `src/zone-setup/` | `zone-setup-methods.js` | Thin re-export only |
| Init / menus | `src/init/` | `init-methods.js` | Thin re-export only |
| Game logic | `src/game-logic/` | `game-logic-methods.js` | Thin re-export only |
| Abilities | `src/abilities/` + `src/game/systems/ability-system.js` | `ability-methods.js` | Registry pattern — see [abilities.md](./abilities.md) |
| Game loop | `src/game-loop/` | `game-loop-*.js` at `src/` root | **Phase A complete** — single folder |
| Input | `src/input-methods.js` | — | Phase B → `InputSystem` |
| Physics factory | `src/physics-factory-methods.js` | — | Phase B → `PhysicsWorld` |
| Marble spawn | `src/marble-management-methods.js` | — | Phase B → `MarbleRegistry` |
| Render sync | `src/game-loop/sync.js` | — | Part of `RenderPipeline` in Phase B |
| HUD | `src/hud-manager.js` + `hud` state | — | Phase B → `HudController` |
| Levels catalog | `src/levels.js` + `src/levels/campaign.js` | — | Chapter progression — see [campaign.md](./campaign.md) |
| Map editor | `src/editor/` | — | `?editor=1` — see [map-editor.md](./map-editor.md) |

### `src/game-loop/` layout (canonical)

| File | Responsibility |
|------|----------------|
| `loop.js` | `loop()` — rAF driver |
| `logic.js` | `updateGameState()` — pre-physics ability/state tick |
| `frame-input.js` | Shortcuts, movement impulses, magnet |
| `camera.js` | Camera matrices, DoF |
| `dynamics-tick.js` | Kinematic platforms, collectibles |
| `hud-tick.js` | Legacy DOM cooldown bars |
| `effects-tick.js` | Black holes, missiles, bombs |
| `finalize-frame.js` | HUDManager + perf + goal FX |
| `render.js` | `renderAndSync()` orchestrator only |
| `sync.js` | `syncTransformsAndRender()` — physics step + draw |
| `speed-lines.js` | Motion overlay |
| `helpers.js` | Shared transform/color helpers |
| `index.js` | `applyGameLoop` exports |

See **[game-loop.md](./game-loop.md)** for the live import graph and per-frame call order.

Root `game-loop-*-methods.js` shims were **removed** July 2026.

## Phased plan

### Phase A — Single home per concern ✅ (in progress)

- [x] `game-loop/` owns update + render + sync (no parallel fat `*-methods.js`)
- [x] `zone-setup/` already canonical (prior cleanup)
- [x] `abilities/`, `game-logic/`, `init/` use thin root re-exports only

### Phase B — Composition (started)

- [x] Constructor state grouped in `src/game/state/*`
- [x] `bindGameState()` mirrors onto `this.*` for existing mixins
- [ ] Extract `PhysicsWorld`, `RenderPipeline`, `InputSystem`, `AbilitySystem`, `HudController`, `LevelLoader` as classes that receive `game` or state slices
- [ ] Replace `apply*Methods` with explicit delegation from `MarblesGame`

### Phase C — TypeScript (started)

- [x] Pilot: `src/math.ts` + `src/types/geometry.ts` (imported via `math.js` shim)
- [x] Selective `checkJs` on pilot paths — see [language-strategy.md](./language-strategy.md)
- [ ] Add JSDoc + `@ts-check` on `wasm-bridge.js`, `game/state/`
- [ ] Migrate `game/systems/` and level catalog types
- [ ] Widen `tsconfig` `include` as each slice passes `npm run typecheck`

## Language & archived code

See **[language-strategy.md](./language-strategy.md)** for:

- When to use C++ vs JavaScript vs TypeScript
- UI stack (vanilla HUD, no in-game React)
- Decisions on `orphan-react-stack` and `experimental-wasm-renderer`

## Mixin deprecation

`apply*Methods(MarblesGame)` copies prototype methods at load time. **Do not add new mixins.** New behavior should go in:

1. `src/game/systems/` (pure logic), or
2. `src/<concern>/` folder module with explicit `apply*` in that folder's `index.js`

Existing mixins remain until Phase B delegation is complete.

## Testing without Filament

Pure modules under `src/game/systems/` are runnable from Node:

```bash
node tests/test_game_systems.js
```

Examples: `ability-cooldown.js`, `trick-scoring.js`. Expand this set as logic is extracted from mixins.

## Cross-cutting coupling today

Mixins communicate via implicit `this.*` on `MarblesGame`. Prefer:

- **Reads**: `this.physics.marbles` or `this.marbles` (same reference after `bindGameState`)
- **New code**: use `this.state.<subsystem>` namespace
- **Avoid**: new flat `this.foo` fields in `main.js` — add to the appropriate `game/state/*.js` factory

## Related docs

- [language-strategy.md](./language-strategy.md) — language boundaries, C++ rules, archived React/WebGPU
- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) — repo layout and entry graph
- [CONTRIBUTING.md](../CONTRIBUTING.md) — adding zones and content
