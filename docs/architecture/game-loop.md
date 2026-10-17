# Game Loop Architecture

**Status:** Canonical — July 2026  
**Entry:** `src/main.js` → composed `RenderPipeline` plus the closed `installGameLoopMethods` compatibility list

## Live runtime graph

```
main.js
  ├── RenderPipeline                      # game/systems/render-pipeline.ts
  │     └── sync.js                       # transform/physics/draw runtime slice
  ├── HudController                       # game/systems/hud-controller.ts
  │     └── hud-tick.js                   # legacy cooldown implementation
  └── installGameLoopMethods              # closed allowlist in game-loop/index.js
        ├── loop.ts, logic.js, speed-lines.js
        ├── frame-input.js, camera.js, dynamics-tick.js
        └── effects-tick.js, finalize-frame.js
```

**Not on the runtime path** (archived under `docs/backups/`):

- `game-runtime-drafts/core.js.orig`, `core.js.broken` — old monolithic loop drafts
- `unused-game-modules/unwired-game-loop/` — `abilities.js`, `camera.js`, `hud.js`, `input.js` never wired to `index.js`

Root `game-loop-*-methods.js` shims (and the later `*-methods.js` ones) were removed; import `game-loop/index.js` directly.

## Per-frame call order

```
loop()                          [loop.ts]
  frameDt = clamp(now − last, 0, 0.25 s)
  pollGamepads()                [InputSystem — delegated from main.js]
  if paused → simDt = 0, physicsSubsteps = 0; renderAndSync() only
  else:
    physicsSubsteps = physicsClock.advance(frameDt)   [FixedStepClock]
    simDt = physicsClock.lastSimDt                    (= substeps × step)
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
        physicsWorld.step() × physicsSubsteps   main thread (prev poses captured before the last)
          — or once in worker mode (flushes commands; the worker steps itself)
        processCollisionEvents()
        checkGameLogic()
        marble + entity transform sync   via backend.getRenderTransform() (interpolated)
        Filament render + speed-lines overlay
  requestAnimationFrame(loop)
```

## Fixed-step simulation

The simulation advances in **fixed steps** regardless of display refresh rate; the same contract applies on the main thread and in the [physics worker](./physics-worker.md#tick-policy-fixed-step-contract).

| Piece | Where | Contract |
|-------|-------|----------|
| `FixedStepClock` | `game/systems/fixed-step-clock.ts` | Pure accumulator. `advance(frameDt)` clamps `frameDt` to ≤ 0.25 s, multiplies by `timeScale`, returns the number of whole steps to run (cap **5**; backlog beyond the cap is dropped, not carried). Exposes `alpha` (leftover / step) and `lastSimDt`. |
| Step size | `game.physicsClock.step` | `1/60` s on the main thread (existing tunings were authored at 60 Hz); `1/physicsHz` (default `1/120`) in the worker. `world.timestep` is always set to the clock step — never scaled. |
| Time scale | `physicsBackend.setTimeScale()` | Slow-mo / focus / time-stop scale **accumulated time**, so a 0.2× slow-mo runs 1/5 as many steps of the same size. In worker mode it is forwarded as `SET_TIME_SCALE`. |
| Interpolation | `physicsBackend.getRenderTransform(body)` | Main thread lerps between the pose before and after the last substep by `clock.alpha`; worker mode blends the two published snapshot slots. Teleport-sized jumps snap. |

Rules that follow from it:

1. **Time-based state uses seconds.** Per-frame code reads `this.frameDt` (wall seconds, for UI/meters/cameras) or `this.simDt` (simulated seconds this frame, for anything that feeds physics). No frame-count counters, and no hard-coded `dt = 0.016`. Legacy per-frame constants are kept by scaling with `frameDt · 60` / `simDt · 60`.
2. **Forces are applied once per frame, before the substeps**, so they must be expressed as velocity change: use `applyVelocityChange(rb, dv)` for instantaneous Δv (jumps, launches) and `applyAcceleration(rb, a, simDt)` for continuous forces (hover, springs, jetpack) from `game/systems/body-impulse.ts`. Both multiply by the body's mass — a raw `applyImpulse` with a hand-tuned constant does nothing on the ~724 kg default marble.
3. **Fast bodies use CCD.** Player/rival marbles, missiles and bombs set `setCcdEnabled(true)` (serialized as `ccd: true` for the worker) so they cannot tunnel through thin walls within a step.
4. **Raycasts go through `this.physicsQueries`** (`castRay(origin, dir, maxToi, { excludeBody, solid, groups, excludeSensors })` → `RayHit | null`). Always pass `excludeBody` when casting from inside a body. Direct `world.castRay` is lint-forbidden outside `physics-queries.ts` / `physics-backend.ts`.
5. **Rewind / per-step recorders** only record on frames where `physicsSubsteps > 0`.

Tests: `tests/test_fixed_step_clock.js` (same distance at 30/60/144/240 Hz within 1%), `tests/test_physics_parity.js` (contract against both backends).

### Phase mapping (target mental model)

| Phase | Primary module | Notes |
|-------|----------------|-------|
| Input poll | `game/systems/input-system.ts` | Gamepad + pause; keyboard read in `frame-input.js` |
| Logic / abilities (pre-step) | `logic.js` | Focus, time-stop, vortex, phase, ice, rewind, etc. |
| Frame input + forces | `frame-input.js`, `effects-tick.js` | Impulses applied **before** `world.step()` |
| Camera | `camera.js` | Uses adrenaline shake from `logic.js` |
| Physics step | `sync.js` | `physicsSubsteps` fixed steps (0…5) per frame — see below |
| Game rules | `sync.js` | `checkGameLogic()` after step |
| Sync + render | `sync.js` | Transforms → Filament, `view.render()` |
| HUD | `game/systems/hud-controller.ts` | Single frame entry for bars, ability HUD, goal FX, desync display |

Ability **spawn** handlers remain in `src/abilities/` (installed via `abilities/index.js`; `AbilitySystem` in `game/systems/ability-system.ts` routes input and HUD). Ability **per-frame tick** is split between `logic.js` (energy/state) and `effects-tick.js` (projectiles).

## Module responsibilities

| File | Methods | Responsibility |
|------|---------|----------------|
| `loop.ts` | `loop` | rAF scheduling, pause branch, `frameDt` / `physicsClock.advance()` → `simDt`, `physicsSubsteps` |
| `logic.js` | `updateGameState` | Ghost, adrenaline/FOV/shake, ability state machine |
| `frame-input.js` | `tickFrameInput` | Key debounce, marble impulses, magnet |
| `camera.js` | `updateCamera` | All camera modes + collision avoidance |
| `dynamics-tick.js` | `tickSceneDynamics` | Kinematic bodies, collectible pickup |
| `hud-tick.js` | `tickHudCooldownBars` | Legacy runtime slice called only by `HudController` |
| `effects-tick.js` | `tickActiveProjectiles` | Active bomb/missile/black-hole visuals + forces |
| `finalize-frame.js` | `finalizeFrame` | Single HUD-controller entry + perf counters |
| `game/systems/render-pipeline.ts` | `renderAndSync` | Main-thread frame and draw orchestrator |
| `sync.js` | `syncTransformsAndRender` | Fixed substeps, interpolated transform sync, Filament draw |
| `speed-lines.js` | `init/update/renderSpeedLines` | Canvas overlay |
| `helpers.ts` | transform/color helpers | Shared by render-phase modules |

## Rules for contributors

1. **One directory** — all loop code lives under `src/game-loop/`. No new `game-loop-*.js` at `src/` root.
2. **Orchestrator stays thin** — `RenderPipeline` only sequences subsystem/tick calls and owns draw dispatch.
3. **No duplicate loops** — do not revive `core.js` monoliths from `docs/backups/`.
4. **New per-frame behavior** — add it to a composed subsystem or the appropriate tick module and explicitly list compatibility methods in `index.js`.
5. **Physics impulses** that must affect the next step go in `frame-input.js`, `effects-tick.js`, or `logic.js` — before `syncTransformsAndRender()` — and follow the [fixed-step rules](#fixed-step-simulation) (Δv / acceleration × `simDt`, never per-frame constants).

## Related docs

- [architecture/README.md](./README.md) — broader Phase A/B migration
- [language-strategy.md](./language-strategy.md) — when to extract pure TS systems from mixins
