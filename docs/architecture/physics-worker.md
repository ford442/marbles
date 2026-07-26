# Physics Worker Architecture

**Status:** Production opt-in — July 2026  
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
| `?physicsWorker=1` | Opt in to worker backend on **manifest** campaign levels |
| `?physicsWorker=0` | Force main-thread Rapier |
| `?physicsHz=60` | Override worker fixed tick (default **120**) |

Requires cross-origin isolation (COOP/COEP). See [`vite.config.js`](../../vite.config.js) and [`docs/mobile-pwa.md`](../mobile-pwa.md). Without `SharedArrayBuffer`, the game falls back to main-thread physics silently.

**Permanent main-thread exclusions:**

| Mode | Reason |
|------|--------|
| Party Race / `multiplayerMode` | Host-authoritative sim on main thread ([host-authority.md](./host-authority.md)) |
| Host authority (`?hostAuth=1`) | Same authority model — do not conflate worker vs host-sim |
| Map editor (`?editor=1`) | Live body creation / inspection not wired through worker |
| Dev-only levels (`?devLevels=1` entries not in manifest) | Opt-in spike scope; use manifest levels for worker A/B |

All **24 manifest** levels (`assets/manifest.json`) are worker-eligible when `?physicsWorker=1` is set.

## SharedArrayBuffer layout

### Transform buffer (worker → main, read-only on main)

Double-buffered body poses. Header + two slots.

| Byte offset | Field | Type | Notes |
|-------------|-------|------|-------|
| 0 | `writeIndex` | `Uint32` | Atomics — active slot (0 or 1) |
| 4 | `frameTick` | `Uint32` | Monotonic physics tick |
| 8 | `bodyCount` | `Uint32` | Active body slots (max index + 1) |
| 12 | `physicsStepMs` | `Float32` | Last step duration (perf) |
| 16 + slot×N | `bodies[i]` | 8× `Float32` | `[px,py,pz, qx,qy,qz,qw, flags]` |

- `MAX_BODIES = 256`, 32 bytes per body per slot.
- Main reads `writeIndex`, then copies poses for sync.
- Body indices are **stable** across spawn/despawn; removed slots are nulled but indices are not reused in the same level session.

### Command ring (main → worker)

| Region | Fields |
|--------|--------|
| Header (12 B) | `head`, `tail`, `capacity` (`Uint32`, Atomics on head/tail) |
| Entries (32 B each) | `op` (`Uint32`), `bodyIndex` (`Uint32`), `f0..f3` (`Float32`) |

Ops: `IMPULSE`, `TORQUE`, `KINEMATIC_POSE`, `KINEMATIC_ROTATION`, `SET_LINVEL`, `SET_ANGVEL`, `SET_GRAVITY_SCALE`, `SET_TIMESTEP`, `REMOVE_BODY`, `STEP`.

World build uses `postMessage` (`INIT_WORLD` with JSON descriptors), not the ring. Runtime bodies (missiles, bombs, holo platforms) use `ADD_BODY` after level commit.

### Raycast result slot

Synchronous queries (camera, abilities, lock-on) use a dedicated SAB slice:

| Field | Type |
|-------|------|
| `status` | `Int32` Atomics (`idle/pending/ready/error`) |
| `hit`, `toi`, `point[3]`, `normal[3]` | `Float32` |
| `hitBodyIndex` | `Uint32` (`0xffffffff` = none) |

Main sets `pending`, worker fills result and sets `ready`; main reads and returns a Rapier-shaped hit proxy (`collider.parent()` → body handle).

## Tick policy

- **Physics:** fixed `1/120` s per step (override `?physicsHz=60`).
- **Render:** rAF (~60 Hz). Worker runs its own 120 Hz interval; main drains commands via `STEP` posts each frame.
- **timeScale:** from focus/time-stop logic scales substep count via `SET_TIMESTEP`.

No render extrapolation yet; main displays the latest completed physics frame.

## Proxy rigid bodies

Main-thread game code keeps calling `rigidBody.translation()`, `applyImpulse()`, `world.createRigidBody()`, etc. In worker mode these are **proxies**:

- Reads → transform SAB (+ cached linvel where needed)
- Writes → command ring entries drained before the next worker step
- `createRigidBody` / `createCollider` → descriptor slots, committed at level load or via `ADD_BODY`

Stable numeric `bodyIndex` assigned at registration preserves ordering between descriptors and proxies.

## Fallback

| Condition | Behavior |
|-----------|----------|
| No `SharedArrayBuffer` / not cross-origin isolated | Main-thread backend |
| `?physicsWorker=0` | Main-thread backend |
| Worker init / `INIT_ERROR` | Main-thread backend, worker disposed |
| Multiplayer, hostAuth, editor | Main-thread backend |
| Non-manifest level with `?physicsWorker=1` | Main-thread backend for that level |

Perf overlay reports `rapier: worker|main` and MarblePhysics backend separately.

## Measurement

Compare with `?renderer=simple&perf=1`:

1. `tutorial` — baseline validation
2. `space_station` — body pressure
3. `mushroom_hop` or `pinwheel_alley` — factory stamp levels
4. `lava_tubes_run` (dev) — particle-heavy; transform sync stays on main

Record `window.perfMonitor.getLevelSummary()` and `latestSyncWork.physicsStepMs` / `mainThreadPhysicsWaitMs`.

**Expected:** `physicsStepMs` on main drops to ~0 in worker mode; transform sync cost unchanged.

## Module map

| Module | Role |
|--------|------|
| [`src/game/physics-worker/protocol.js`](../../src/game/physics-worker/protocol.js) | Buffer layout, op codes |
| [`src/game/physics-worker/command-drain.js`](../../src/game/physics-worker/command-drain.js) | Command ring drain (worker + tests) |
| [`src/game/physics-worker/rapier-desc-serializer.js`](../../src/game/physics-worker/rapier-desc-serializer.js) | Rapier desc → JSON for worker |
| [`src/game/systems/physics-backend.js`](../../src/game/systems/physics-backend.js) | Backend selection, main/worker implementations |
| [`src/game/physics-worker/physics-worker.js`](../../src/game/physics-worker/physics-worker.js) | Worker entry |
| [`src/game/physics-worker/world-builder.js`](../../src/game/physics-worker/world-builder.js) | Build Rapier world from descriptors |

## Follow-up

- Host-authoritative sim in worker ([host-authority.md](./host-authority.md))
- Transform interpolation between physics frames
- Map editor worker integration
- Default-on desktop after broader soak testing
- `RenderPipeline` extraction (Phase B)
