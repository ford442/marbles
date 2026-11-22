# Physics determinism

**Status:** November 2026 (Rapier 0.21.0)  
**Related:** [physics-worker.md](./physics-worker.md), [host-authority.md](./host-authority.md), [game-loop.md](./game-loop.md), [../PERFORMANCE_BASELINE.md](../PERFORMANCE_BASELINE.md)

Ranked Party Race and replay verification need two machines running the same build to compute the same simulation. This page says what is guaranteed, how it is tested, and what still stands between that guarantee and a ranked mode.

## What holds

Given the **same build, the same fixed step, and the same inputs applied on the same steps**, the Rapier world is bit-for-bit identical after every step:

| Compared | Checked by | Result |
|---|---|---|
| Main-thread backend vs worker backend (SharedArrayBuffer transport, command ring, proxy bodies) | `tests/test_physics_determinism.js` | SHA-256 of `world.takeSnapshot()` equal on each of 480 steps, at 120 Hz and 60 Hz |
| This machine vs the machine that recorded the fixture | same test, `tests/fixtures/physics-determinism.json` | run digest equal (CI runs it on every push) |
| Node (headless sim) vs Chromium page vs Chromium Web Worker | `npm run test:e2e:determinism` | same digests as the fixture |
| A repeat run / a different seed | same test (controls) | equal / different |

The scenario (`tests/support/physics-determinism.js`) is built through the game-facing API on both backends: fixed geometry including a trimesh and a sensor, a kinematic platform, marbles with CCD, damping and gravity-scale variety, a stack that goes to sleep, projectiles spawned and removed at run time, impulses, torques, teleports, and raycasts whose hits feed back into the inputs.

Why it holds: Rapier runs as WebAssembly, whose float arithmetic is IEEE 754 and identical on every engine and CPU. The one hole in that guarantee is the bit pattern of a NaN, and a NaN in the world state is already a bug.

## What the test caught

Building it found one real difference between the backends. A ray hit's `point` was computed in float64 on the main thread but came back from the worker through a `Float32Array`. Anything derived from a hit point (blink target, grapple anchor) could therefore differ in the last bit between backends. `rayPointAt` now rounds to float32 on both.

## What is *not* covered

These are properties of how the game drives the simulation, not of Rapier. Each one must be addressed before two clients can be expected to agree in live play.

1. **The live worker applies inputs when they arrive.** The worker steps on its own timer; a command enqueued by the main thread lands on whichever step drains it. The test ticks the worker state machine by hand, so inputs land on known steps. A lockstep mode needs inputs tagged with a step index.
2. **The two backends default to different step sizes.** Main thread: 60 Hz. Worker: 120 Hz (`?physicsHz=60` lowers it; `WorkerPhysicsBackend.init({ physicsHz })` forces it). Different step sizes are different simulations.
3. **Creation and removal order.** In worker mode `ADD_BODY` is applied when the message arrives and `REMOVE_BODY` when the ring drains, so "remove A, then create B" in one frame can assign Rapier handles differently from the main thread. The scenario issues creations first on both backends.
4. **`Math.sin` / `cos` / `pow` in input generation.** They may differ in the last bit between JS engines. Movers and spinners are posed with them, so a V8 client and a non-V8 client can feed different kinematic poses. The test scenario uses only `+ − × ÷ √`.
5. **MarblePhysics kernels.** The C++ WASM kernels are float32, the JS fallbacks float64. They agree to within a pinned number of float32 ULPs (`tests/test_wasm_parity_ulp.js`), not bit for bit, and near a kernel's cut-off they can take different branches. A ranked build should require the same backend on every client (`getPhysicsBackend()`).
6. **Different builds.** A different Rapier version is a different simulation. The fixture records the version and the test refuses to compare across versions.

Ghost replays (`replay-codec.ts`) are recorded pose streams, so they do not depend on any of this.

## Raycast contract

All gameplay rays go through `game.physicsQueries` and return the same `RayHit` on both backends (`testRayQueryContract` in `tests/test_physics_parity.js`):

- `toi` is in units of `|dir|`; `point = origin + dir * toi`, rounded to float32.
- A solid ray starting inside a shape hits it at `toi = 0`; pass `excludeBody` to skip the caster.
- `excludeSensors` skips sensors and nothing else. `excludeDynamic` skips colliders on dynamic bodies.

**Changed by the Rapier upgrade:** in 0.13 the JS `QueryFilterFlags` values were one bit below the engine's, so `EXCLUDE_SENSORS` actually excluded *dynamic bodies* and still hit sensors. From 0.21 the flag does what it says. Ground checks, wall checks, the rolling-surface probe, particle occlusion and the missile sweep now ignore trigger volumes and see dynamic bodies, as their code always intended. Camera collision keeps ignoring dynamic bodies, now explicitly via `excludeDynamic`, so the camera does not pull in when a prop or another marble crosses behind the player.

Scene queries read the broad-phase BVH, which only `world.step()` rebuilds; `World.updateSceneQueries()` no longer exists. A ray cast before the first step sees nothing. The headless harness runs one zero-length step for that (`refreshSceneQueries`).

## Other behaviour changes in Rapier 0.21

- A fast body no longer tunnels through a thin **fixed** wall without CCD. It still tunnels through a thin **dynamic** body, so missiles keep CCD.
- Every recorded level `solution` is an open-loop input track and diverges under any solver change. The 40 that stopped replaying were re-recorded; medals are unchanged.
- The WASM is 3.1 MB (1.5 MB in 0.13.1). See the bundle section of [PERFORMANCE_BASELINE.md](../PERFORMANCE_BASELINE.md).

## Re-recording after a deliberate change

```bash
npm run test:determinism -- --update     # new digests after a Rapier upgrade or a scenario edit
npm run test:e2e:determinism             # the browser must reproduce them
```

A digest mismatch on an unchanged tree is the signal this page exists for: some machine or runtime computed different bits. Do not re-record over it; find out which input or build differed.
