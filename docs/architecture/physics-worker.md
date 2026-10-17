# Physics Worker Architecture

**Status:** Production opt-in — July 2026 (fixed-step contract + snapshot v2: October 2026)  
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

**Snapshot layout version: 2** (`SNAPSHOT_LAYOUT_VERSION` in `protocol.js`). The worker writes it into the header and echoes it in `WORKER_READY`; the main thread rejects a mismatch (falls back to main-thread physics) instead of misreading the buffer. Bump it whenever any offset below changes.

### Transform buffer (worker → main, read-only on main)

Double-buffered body records. 32-byte header + two slots.

| Header word | Field | Type | Notes |
|-------------|-------|------|-------|
| 0 | `writeIndex` | `Uint32` | Atomics — last published slot (0 or 1) |
| 1 | `frameTick` | `Uint32` | Monotonic publish counter |
| 2 | `bodyCount` | `Uint32` | Active body slots (max index + 1, ≤ `MAX_BODIES`) |
| 3 | `physicsStepMs` | `Float32` | Wall time of the last tick's steps (perf) |
| 4 | `layoutVersion` | `Uint32` | `SNAPSHOT_LAYOUT_VERSION` |
| 5 | `stepIntervalMs` | `Float32` | Wall ms per fixed step at the current time scale (`step·1000 / timeScale`, 0 when frozen) — drives render interpolation |

Each body record is 16 `Float32` (64 bytes):

| Float | Field |
|-------|-------|
| 0–2 | position |
| 3–6 | rotation quaternion |
| 7 | valid (0 = removed / empty) |
| 8–10 | linear velocity |
| 11–13 | angular velocity |
| 14 | mass |
| 15 | body type (`BODY_TYPE_CODE`: dynamic 0, fixed 1, kinematic-position 2, kinematic-velocity 3) |

- `MAX_BODIES = 256`; bodies past the cap are not written (no overflow into the next slot).
- Velocities, mass and type are the **real** post-step values; proxies read them directly (no dead reckoning). They lag main-thread writes by at most one worker tick.
- Body indices are **stable** across spawn/despawn; removed slots are nulled but indices are not reused in the same level session.

### Command ring (main → worker)

| Region | Fields |
|--------|--------|
| Header (12 B) | `head`, `tail`, `capacity` (`Uint32`, Atomics on head/tail) |
| Entries (32 B each) | `op` (`Uint32`), `bodyIndex` (`Uint32`), `f0..f3` (`Float32`) |

Ops: `IMPULSE`, `TORQUE`, `KINEMATIC_POSE`, `KINEMATIC_ROTATION`, `SET_TRANSLATION`, `SET_ROTATION`, `SET_LINVEL`, `SET_ANGVEL`, `SET_GRAVITY_SCALE`, `SET_TIME_SCALE`, `SET_CCD`, `REMOVE_BODY`, `STEP`.

The ring is drained by `drainCommandRing()` (`command-drain.js`) at the start of every worker tick — there is a single drain path, shared with the unit tests. `SET_TIME_SCALE` sets the worker clock's `timeScale` (it does **not** touch `world.timestep`).

World build uses `postMessage` (`INIT_WORLD` with JSON descriptors), not the ring. Runtime bodies (missiles, bombs, holo platforms) use `ADD_BODY` after level commit. `rapier-desc-serializer.js` supports ball, cuboid, capsule, cylinder, cone and trimesh colliders (plus sensor flag, local offset/rotation, collision groups and body CCD) and **throws** on any other shape rather than substituting a placeholder.

### Raycast result slot

All gameplay raycasts go through `game.physicsQueries` ([`physics-queries.ts`](../../src/game/systems/physics-queries.ts)); in worker mode it calls `WorkerPhysicsBackend.castRay`, which posts `RAYCAST` and spin-waits on a dedicated SAB slice:

| Field | Type |
|-------|------|
| `status` | `Int32` Atomics (`idle/pending/ready/error`) |
| `hit`, `toi`, `point[3]`, `normal[3]` | `Float32` |
| `hitBodyIndex` | `Uint32` (`0xffffffff` = none) |
| `hitBodyType` | `Int32` (−1 = parentless collider) |
| `colliderHandle` | `Float64` |

The request carries `excludeBodyIndex`, `solid`, `groups` and `excludeSensors`; the worker runs the same `RapierPhysicsQueries` implementation as the main thread, so exclusion and hit fields are identical across backends. The main thread returns a `RayHit` whose `body` is the registered proxy (`physicsQueries.isBodyAlive(body)` tells callers when it has been removed).

## Tick policy (fixed-step contract)

Both backends follow the same contract (see [game-loop.md](./game-loop.md#fixed-step-simulation)):

- The worker owns a `FixedStepClock` with `step = 1 / physicsHz` (default `1/120`, `?physicsHz=60` to override). Each timer tick feeds elapsed **wall** time into the clock, which scales it by `timeScale`, runs whole fixed steps (cap 5 per tick, excess dropped), then publishes **once**.
- `world.timestep` is always `clock.step`. Slow-mo / time-stop only change how much time is accumulated (`backend.setTimeScale()` → `SET_TIME_SCALE`).
- The main thread does not step the world in worker mode; `physicsWorld.step()` only flushes queued commands.
- **Render interpolation:** `getRenderTransform(body)` blends the previous and latest published slots by `alpha = elapsedSinceFrameReady / stepIntervalMs`. Large jumps (teleports, respawns) snap instead of lerping.

## Proxy rigid bodies

Main-thread game code keeps calling `rigidBody.translation()`, `applyImpulse()`, `world.createRigidBody()`, etc. In worker mode these are **proxies**:

- Reads → transform SAB: `translation`, `rotation`, `linvel`, `angvel`, `mass`, `bodyType`, `isValid`
- Writes → command ring entries drained before the next worker step (`enableCcd` → `SET_CCD`)
- `createRigidBody` / `createCollider` → descriptor slots, committed at level load or via `ADD_BODY`
- The proxy world has **no** `castRay` / `timestep`: queries go through `game.physicsQueries`, timing through the clock.

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
| [`src/game/systems/physics-backend.ts`](../../src/game/systems/physics-backend.ts) | Backend selection, main/worker implementations |
| [`src/game/physics-worker/physics-worker.js`](../../src/game/physics-worker/physics-worker.js) | Worker entry (wires `self` to the sim) |
| [`src/game/physics-worker/worker-sim.js`](../../src/game/physics-worker/worker-sim.js) | Worker state machine: clock, drain, step, publish, raycasts (drivable in-process by tests) |
| [`src/game/systems/physics-queries.ts`](../../src/game/systems/physics-queries.ts) | Typed raycast facade (`RayHit`), shared by both backends |
| [`src/game/systems/fixed-step-clock.ts`](../../src/game/systems/fixed-step-clock.ts) | Accumulator / substep cap / time scale / `alpha` |
| [`src/game/physics-worker/world-builder.js`](../../src/game/physics-worker/world-builder.js) | Build Rapier world from descriptors |

## Tests

`tests/test_physics_parity.js` runs the same gameplay scenarios (grounding, velocity readback, blink, grapple, double jump, missile CCD, slow-mo) against the main-thread backend and against `WorkerPhysicsBackend` driving `createWorkerSim` in-process over real SharedArrayBuffers. Any backend divergence should fail there first.

## Follow-up

- Host-authoritative sim in worker ([host-authority.md](./host-authority.md))
- Map editor worker integration
- Default-on desktop after broader soak testing
- `RenderPipeline` extraction (Phase B)
