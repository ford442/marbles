# Game Loop Architecture

**Status:** Canonical — July 2026  
**Entry:** `src/main.js` → `applyGameLoop(MarblesGame)` from `src/game-loop/index.js`

## Live runtime graph

```
main.js
  └── applyGameLoop(MarblesGame)          # game-loop/index.js
        ├── loop.js                       # loop() — rAF driver
        ├── logic.js                      # updateGameState() — pre-physics logic
        ├── speed-lines.js                # overlay canvas effect
        ├── frame-input.js                # shortcuts, movement impulses, magnet
        ├── camera.js                     # camera matrices, DoF, FOV
        ├── dynamics-tick.js              # kinematic platforms, collectibles, grapple
        ├── hud-tick.js                   # legacy DOM cooldown bars
        ├── effects-tick.js               # black holes, missiles, bombs (pre-step forces)
        ├── finalize-frame.js             # HUDManager, perf, goal FX
        ├── render.js                     # renderAndSync() orchestrator
        └── sync.js                       # syncTransformsAndRender() — physics + draw
```

**Not on the runtime path** (archived under `docs/backups/`):

- `game-runtime-drafts/core.js.orig`, `core.js.broken` — old monolithic loop drafts
- `unused-game-modules/unwired-game-loop/` — `abilities.js`, `camera.js`, `hud.js`, `input.js` never wired to `index.js`

Root `game-loop-*-methods.js` shims were removed; import `game-loop/index.js` directly.

## Per-frame call order

```
loop()                          [loop.js]
  pollGamepads()                [input-methods.js — mixin]
  if paused → renderAndSync() only
  else:
    updateGameState()           [logic.js]
    renderAndSync()             [render.js orchestrator]
      tickFrameInput()          shortcuts, WASD impulses, boost, magnet forces
      updateCamera()            orbit/follow/fpv/cinematic/drone matrices
      tickSceneDynamics()       moving platforms, power-ups, collectibles, grapple
      tickHudCooldownBars()     per-ability DOM bar widths
      tickActiveProjectiles()   black-hole / missile / bomb lifecycle + forces
      finalizeFrame()           hudManager.updateAllAbilities(), perf, goal FX
      syncTransformsAndRender() [sync.js]
        … particle / platform housekeeping …
        world.step()            Rapier physics (skipped when paused)
        processCollisionEvents()
        checkGameLogic()
        marble + entity transform sync
        Filament render + speed-lines overlay
  requestAnimationFrame(loop)
```

### Phase mapping (target mental model)

| Phase | Primary module | Notes |
|-------|----------------|-------|
| Input poll | `input-methods.js` | Gamepad + pause; keyboard read in `frame-input.js` |
| Logic / abilities (pre-step) | `logic.js` | Focus, time-stop, vortex, phase, ice, rewind, etc. |
| Frame input + forces | `frame-input.js`, `effects-tick.js` | Impulses applied **before** `world.step()` |
| Camera | `camera.js` | Uses adrenaline shake from `logic.js` |
| Physics step | `sync.js` | `world.step()` once per frame |
| Game rules | `sync.js` | `checkGameLogic()` after step |
| Sync + render | `sync.js` | Transforms → Filament, `view.render()` |
| HUD | `hud-tick.js`, `finalize-frame.js`, `hud-manager.js` | DOM bars + consolidated ability HUD |

Ability **spawn** handlers remain in `src/abilities/` (mixed in via `ability-methods.js`). Ability **per-frame tick** is split between `logic.js` (energy/state) and `effects-tick.js` (projectiles).

## Module responsibilities

| File | Methods | Responsibility |
|------|---------|----------------|
| `loop.js` | `loop` | rAF scheduling, pause branch |
| `logic.js` | `updateGameState` | Ghost, adrenaline/FOV/shake, ability state machine |
| `frame-input.js` | `tickFrameInput` | Key debounce, marble impulses, magnet |
| `camera.js` | `updateCamera` | All camera modes + collision avoidance |
| `dynamics-tick.js` | `tickSceneDynamics` | Kinematic bodies, collectible pickup |
| `hud-tick.js` | `tickHudCooldownBars` | Legacy `#*bar` DOM elements |
| `effects-tick.js` | `tickActiveProjectiles` | Active bomb/missile/black-hole visuals + forces |
| `finalize-frame.js` | `finalizeFrame` | `hudManager`, perf counters, goal effects |
| `render.js` | `renderAndSync` | Thin orchestrator — **do not add logic here** |
| `sync.js` | `syncTransformsAndRender` | Physics step, transform sync, Filament draw |
| `speed-lines.js` | `init/update/renderSpeedLines` | Canvas overlay |
| `helpers.js` | transform/color helpers | Shared by render-phase modules |

## Rules for contributors

1. **One directory** — all loop code lives under `src/game-loop/`. No new `game-loop-*.js` at `src/` root.
2. **Orchestrator stays thin** — `render.js` only sequences `tick*` / `update*` calls.
3. **No duplicate loops** — do not revive `core.js` monoliths from `docs/backups/`.
4. **New per-frame behavior** — add a method to the appropriate module (or a new `*-tick.js`) and register `apply*` in `index.js`.
5. **Physics impulses** that must affect the next step go in `frame-input.js`, `effects-tick.js`, or `logic.js` — before `syncTransformsAndRender()`.

## Related docs

- [architecture/README.md](./README.md) — broader Phase A/B migration
- [language-strategy.md](./language-strategy.md) — when to extract pure TS systems from mixins
