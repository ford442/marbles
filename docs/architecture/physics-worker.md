# Physics Worker Architecture

**Status:** Default-on for capable desktops (manifest campaign) — October 2026 (fixed-step contract); snapshot layout v4 with recycled body slots, Party Race host sim on the worker clock — November 2026  
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
| *(none)* | Worker on for **manifest** campaign levels when cross-origin isolated and not low-power (`detectPlatformProfile().prefersLowPower`: mobile UA or ≤4 cores) |
| `?physicsWorker=1` | Force on, including low-power/mobile (A/B) — exclusions below still apply |
| `?physicsWorker=0` | Kill switch: force main-thread Rapier |
| `?physicsHz=60` | Override worker fixed tick (default **120**) |

Requires cross-origin isolation (COOP/COEP). See [`vite.config.js`](../../vite.config.js) and [`docs/mobile-pwa.md`](../mobile-pwa.md). Without `SharedArrayBuffer`, the game falls back to main-thread physics silently.

**Main-thread exclusions** (enforced in `shouldUsePhysicsWorker()`; these levels are never routed through the ring):

| Mode | Reason |
|------|--------|
| Map editor (`?editor=1`) | Live body creation / inspection is not wired through the worker. Applies to every level an editor session loads, including manifest levels. Stays main-thread until a later issue; slot reuse does not depend on it. |
| Dev-only levels (`?devLevels=1` entries not in manifest) | Opt-in sandbox scope; use manifest levels for worker A/B |

All **44 manifest** levels (`assets/manifest.json`) are worker-eligible, in campaign **and** Party Race (`multiplayerMode`, `?hostAuth=1`). Fallback to main thread on worker `INIT_ERROR` is unchanged. There is no settings-pane toggle yet; the URL flag is the only override.

### Party Race host sim

| Mode | Backend | Who steps the world |
|------|---------|---------------------|
| Campaign, manifest level | Worker | Worker `FixedStepClock` (120 Hz) |
| Party Race host, `?hostAuth=1`, manifest level | Worker | Worker `FixedStepClock` — the same single clock |
| Any of the above with `?physicsWorker=0`, no COOP/COEP, or low-power | Main | Frame loop's `FixedStepClock` (`sync.js`) |
| Editor, non-manifest dev level | Main | Frame loop's `FixedStepClock` |

`HostSim.tick` ([`host-sim.js`](../../src/game/network/host-sim.js)) never calls `world.step()`. Once per frame it turns each player's latest 30 Hz input snapshot into impulses on the network marbles (`applyInputToMarble`, scaled by `simDt·60` like local held-key movement and **not** by mass) and broadcasts poses. On the worker those impulses ride the command ring and are applied on the worker's next tick; on the main-thread backend they land before the loop's `physicsWorld.step()` calls. There is no host-side accumulator. (Before this change the host stepped once from the frame loop and again from `HostSim` every 16 ms.) Client prediction (`client-prediction.js`) keeps its soft blend / hard snap; rewind is out of scope.

## SharedArrayBuffer layout

**Snapshot layout version: 4** (`SNAPSHOT_LAYOUT_VERSION` in `protocol.js`). The worker writes it into the header and echoes it in `WORKER_READY`; the main thread rejects a mismatch (falls back to main-thread physics) instead of misreading the buffer. Bump it whenever any offset below changes.

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
| 6 | `removalsApplied` | `Uint32` | Atomics. Running count of `REMOVE_BODY` ring entries the worker has consumed (v4). Gates body-index reuse. |

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

- `MAX_BODIES = 1024` (256 before v3), 64 bytes per body per slot; bodies past the cap are not written (no overflow into the next slot). Bump the layout version on any size/stride change or header change.
- Runtime bodies (missiles, bombs, black holes, holo platforms, hover) go through the proxy world → `ADD_BODY`.
- Velocities, mass and type are the **real** post-step values; proxies read them directly (no dead reckoning). They lag main-thread writes by at most one worker tick.

### Body-index reuse (v4)

`MAX_BODIES` bounds **live** bodies, not bodies spawned per level.

1. `removeRigidBody(proxy)` freezes the proxy's last snapshot into a tombstone, unregisters it, enqueues `REMOVE_BODY` and records `(index, seq)`. `seq` is the main thread's running removal count.
2. The worker drains the ring, removes the Rapier body, nulls the slot (the record publishes `valid = 0`) and bumps header word 6.
3. On `backend.step()` and on every `reserveBodyIndex()`, indices whose `seq ≤ removalsApplied` move to a FIFO free list. `reserveBodyIndex()` takes from that list before it grows the high-water mark.
4. A reused index is filled by `ADD_BODY`, which seeds both slots before anything reads it.

Rules:

- **Never recycle before the ack.** Until the worker has applied the removal it may still hold the old body at that index.
- **A stale proxy never sees its successor.** A removed proxy's reads return its tombstone, including `getRenderTransform`. Its writes and a repeat `removeRigidBody` are dropped (`backend.isCurrentProxy(index, proxy)`), and `isValid()` is false.
- **No wrap.** If all 1024 indices are live or awaiting their ack, `reserveBodyIndex()` throws `RangeError`, and the worker refuses out-of-range inserts.
- If the ring is full and `REMOVE_BODY` can't be enqueued, the index stays occupied until the level reloads. It leaks; it is never double-booked.
- `RESET_WORLD` discards leftover ring entries (except `SET_TIME_SCALE`) and still counts their removals, so a later world never receives an earlier world's commands and the counters stay aligned.

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
| Editor (any level) | Main-thread backend |
| Snapshot layout mismatch (`WORKER_READY` header ≠ `SNAPSHOT_LAYOUT_VERSION`) | `init()` rejects → main-thread backend |
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

`tests/test_physics_worker_slots.js` uses the same in-process worker. It covers:

- 3 × `MAX_BODIES` missile spawn/despawns in one level load, with no `RangeError`
- no reuse before the ack
- stale-proxy isolation
- the full-table `RangeError`
- layout-mismatch rejection
- the `?hostAuth=1` host sim: one input applied on both backends, with `HostSim` never stepping the world

## Follow-up

- Map editor worker integration (live body creation through the proxy world)
- Settings-pane toggle for the worker
- Real-GPU soak of all 44 manifest ids, campaign and Party Race host (`docs/PERFORMANCE_BASELINE.md`)
- Option C headless host (separate service on `@dimforge/rapier3d-compat` / upstream Rapier) if host-desync makes ranked unplayable — see [host-authority.md](./host-authority.md)
