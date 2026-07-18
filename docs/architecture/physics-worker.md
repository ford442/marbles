# Physics Worker Architecture

**Status:** Spike (tutorial level) — July 2026  
**Related:** [game-loop.md](./game-loop.md), [language-strategy.md](./language-strategy.md), [host-authority.md](./host-authority.md)

## Overview

Marbles 3D decouples Rapier simulation from the main thread so Filament rendering and HUD stay responsive. The physics worker owns `world.step()` at a **fixed 120 Hz**; the main thread reads transform snapshots via SharedArrayBuffer and applies them to Filament each display frame (~60 Hz rAF).

```
Main thread                    Physics worker
─────────────                  ──────────────
input → command ring  ──SAB──►  Rapier step @ 120 Hz
render Filament        ◄─SAB──  transform double-buffer
HUD / audio                    MarblePhysics force kernels (optional)
```

Filament **must** remain on the main thread (WebGL context affinity).

## Enablement

| URL flag | Effect |
|----------|--------|
| `?physicsWorker=1` | Opt in to worker backend (tutorial level only in spike) |
| `?physicsWorker=0` | Force main-thread Rapier |
| `?physicsHz=60` | Override worker fixed tick (default **120**) |

Requires cross-origin isolation (COOP/COEP). See [`vite.config.js`](../../vite.config.js) and [`docs/mobile-pwa.md`](../mobile-pwa.md). Without `SharedArrayBuffer`, the game falls back to main-thread physics silently.

**Spike exclusions (main-thread forced):**

- Party Race / `multiplayerMode`
- Host authority (`?hostAuth=1`)
- Map editor (`?editor=1`)
- Any level other than `tutorial`

## SharedArrayBuffer layout

### Transform buffer (worker → main, read-only on main)

Double-buffered body poses. Header + two slots.

| Byte offset | Field | Type | Notes |
|-------------|-------|------|-------|
| 0 | `writeIndex` | `Uint32` | Atomics — active slot (0 or 1) |
| 4 | `frameTick` | `Uint32` | Monotonic physics tick |
| 8 | `bodyCount` | `Uint32` | Active bodies |
| 12 | `physicsStepMs` | `Float32` | Last step duration (perf) |
| 16 + slot×N | `bodies[i]` | 8× `Float32` | `[px,py,pz, qx,qy,qz,qw, flags]` |

- `MAX_BODIES = 256`, 32 bytes per body per slot.
- Main reads `writeIndex`, then copies poses for sync.

### Command ring (main → worker)

| Region | Fields |
|--------|--------|
| Header (12 B) | `head`, `tail`, `capacity` (`Uint32`, Atomics on head/tail) |
| Entries (32 B each) | `op` (`Uint32`), `bodyIndex` (`Uint32`), `f0..f3` (`Float32`) |

Ops: `IMPULSE`, `TORQUE`, `KINEMATIC_POSE`, `SET_LINVEL`, `SET_ANGVEL`, `SET_GRAVITY_SCALE`, `SET_TIMESTEP`, `REMOVE_BODY`, `STEP`.

World build uses `postMessage` (`INIT_WORLD` with JSON descriptors), not the ring.

### Raycast result slot

Synchronous queries (camera, abilities) use a dedicated SAB slice:

| Field | Type |
|-------|------|
| `status` | `Int32` Atomics (`idle/pending/ready/error`) |
| `hit`, `toi`, `point[3]`, `normal[3]` | `Float32` |

Main sets `pending`, worker fills result and sets `ready`; main reads and resets.

## Tick policy

- **Physics:** fixed `1/120` s per step (override `?physicsHz=60`).
- **Render:** rAF (~60 Hz). Main sends one `STEP` per rendered frame with `substeps = round(120/60 × timeScale)` (typically 2).
- **timeScale:** from focus/time-stop logic scales substep count via `SET_TIMESTEP` / substep multiplier.

No render extrapolation in the spike; main displays the latest completed physics frame.

## Proxy rigid bodies

Main-thread game code keeps calling `rigidBody.translation()`, `applyImpulse()`, etc. In worker mode these are **proxies**:

- Reads → transform SAB (+ cached linvel where needed)
- Writes → command ring entries drained before the next worker step

Stable numeric `bodyIndex` assigned at level load preserves ordering between descriptors and proxies.

## Fallback

| Condition | Behavior |
|-----------|----------|
| No `SharedArrayBuffer` / not cross-origin isolated | Main-thread backend |
| `?physicsWorker=0` | Main-thread backend |
| Worker init / `INIT_ERROR` | Main-thread backend, worker disposed |
| Multiplayer, hostAuth, editor | Main-thread backend |
| Non-tutorial level with `?physicsWorker=1` | Main-thread backend for that level |

Perf overlay reports `rapier: worker|main` and MarblePhysics backend separately.

## Measurement

Compare with `?renderer=simple&perf=1`:

1. `tutorial` — spike validation
2. `space_station` — body pressure (main-thread only until expanded)
3. `lava_tubes_run` — particle-heavy (transform sync stays on main)

Record `window.perfMonitor.getLevelSummary()` and `latestSyncWork.physicsStepMs` / `mainThreadPhysicsWaitMs`.

**Expected:** `physicsStepMs` on main drops to ~0 in worker mode; transform sync cost unchanged.

## Module map

| Module | Role |
|--------|------|
| [`src/game/physics-worker/protocol.js`](../../src/game/physics-worker/protocol.js) | Buffer layout, op codes |
| [`src/game/systems/physics-backend.js`](../../src/game/systems/physics-backend.js) | Backend selection, main/worker implementations |
| [`src/game/physics-worker/physics-worker.js`](../../src/game/physics-worker/physics-worker.js) | Worker entry |
| [`src/game/physics-worker/world-builder.js`](../../src/game/physics-worker/world-builder.js) | Build Rapier world from descriptors |

## Follow-up (out of spike scope)

- Host-authoritative sim in worker ([host-authority.md](./host-authority.md))
- Transform interpolation between physics frames
- All levels + full ability raycast parity
- `RenderPipeline` extraction (Phase B)
