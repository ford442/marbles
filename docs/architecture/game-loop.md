# Game Loop Architecture

**Status:** Canonical — July 2026  
**Entry:** `src/main.js` → composed `RenderPipeline` plus the closed `installGameLoopMethods` compatibility list

## Live runtime graph

```
main.js
  ├── RenderPipeline                      # game/systems/render-pipeline.js
  │     └── sync.js                       # transform/physics/draw runtime slice
  ├── HudController                       # game/systems/hud-controller.js
  │     └── hud-tick.js                   # legacy cooldown implementation
  └── installGameLoopMethods              # closed allowlist in game-loop/index.js
        ├── loop.js, logic.js, speed-lines.js
        ├── frame-input.js, camera.js, dynamics-tick.js
        └── effects-tick.js, finalize-frame.js
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
    renderAndSync()             [RenderPipeline]
      tickFrameInput()          shortcuts, WASD impulses, boost, magnet forces
      updateCamera()            orbit/follow/fpv/cinematic/drone matrices
      tickSceneDynamics()       moving platforms, power-ups, collectibles, grapple
      tickActiveProjectiles()   black-hole / missile / bomb lifecycle + forces
      finalizeFrame()           HudController.updateFrame(), perf
        tickHudCooldownBars()   per-ability DOM bar widths
        updateAllAbilities()    consolidated ability HUD
        updateGoalEffects()     goal-zone presentation
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
| HUD | `game/systems/hud-controller.js` | Single frame entry for bars, ability HUD, goal FX, desync display |

Ability **spawn** handlers remain in `src/abilities/` (mixed in via `ability-methods.js`). Ability **per-frame tick** is split between `logic.js` (energy/state) and `effects-tick.js` (projectiles).

## Module responsibilities

| File | Methods | Responsibility |
|------|---------|----------------|
| `loop.js` | `loop` | rAF scheduling, pause branch |
| `logic.js` | `updateGameState` | Ghost, adrenaline/FOV/shake, ability state machine |
| `frame-input.js` | `tickFrameInput` | Key debounce, marble impulses, magnet |
| `camera.js` | `updateCamera` | All camera modes + collision avoidance |
| `dynamics-tick.js` | `tickSceneDynamics` | Kinematic bodies, collectible pickup |
| `hud-tick.js` | `tickHudCooldownBars` | Legacy runtime slice called only by `HudController` |
| `effects-tick.js` | `tickActiveProjectiles` | Active bomb/missile/black-hole visuals + forces |
| `finalize-frame.js` | `finalizeFrame` | Single HUD-controller entry + perf counters |
| `game/systems/render-pipeline.js` | `renderAndSync` | Main-thread frame and draw orchestrator |
| `sync.js` | `syncTransformsAndRender` | Physics step, transform sync, Filament draw |
| `speed-lines.js` | `init/update/renderSpeedLines` | Canvas overlay |
| `helpers.js` | transform/color helpers | Shared by render-phase modules |

## Rules for contributors

1. **One directory** — all loop code lives under `src/game-loop/`. No new `game-loop-*.js` at `src/` root.
2. **Orchestrator stays thin** — `RenderPipeline` only sequences subsystem/tick calls and owns draw dispatch.
3. **No duplicate loops** — do not revive `core.js` monoliths from `docs/backups/`.
4. **New per-frame behavior** — add it to a composed subsystem or the appropriate tick module and explicitly list compatibility methods in `index.js`.
5. **Physics impulses** that must affect the next step go in `frame-input.js`, `effects-tick.js`, or `logic.js` — before `syncTransformsAndRender()`.

## Related docs

- [architecture/README.md](./README.md) — broader Phase A/B migration
- [language-strategy.md](./language-strategy.md) — when to extract pure TS systems from mixins
