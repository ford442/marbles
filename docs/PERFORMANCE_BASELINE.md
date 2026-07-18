# Performance Baseline

This report captures the first pass of renderer/physics telemetry before larger performance work. The run used the Filament path with the new perf overlay enabled.

## How to Use

Start the game and enable the perf overlay:

```bash
npm run dev -- --host 127.0.0.1
```

Open one of these URLs:

- `/?renderer=filament&perf=1` for overlay plus console/load summaries.
- `/?renderer=filament&fps=1` for the visible FPS overlay.
- `/?renderer=simple&perf=1` to compare the shared physics state through the simplified WebGL2 renderer.
- Add `?staticBatch=0` or `?noStaticBatch` to disable static-box batching for A/B comparisons.
- Add `?wasmPhysics=0` to force MarblePhysics JS fallbacks (WASM loads by default when built).
- Add `?culling=0`, `?noCulling`, or `?noCull` to disable CPU-side visual culling for A/B comparisons.

Press `F2` to toggle the overlay. The setting is persisted in `localStorage` under `marbles.perfOverlay`.

Useful browser console probes:

```javascript
window.perfMonitor.collectMetrics()
window.perfMonitor.getLevelSummary()
window.perfLevelLoads
window.cullingStats
```

The overlay reports FPS, p95 frame time, latest entity/body/particle/light counts, estimated transform writes, and a small frame-time graph.
It also reports static batch group/box counts when the Filament static-box batcher is active, plus current culled static, dynamic, and particle visual counts.

## Measurement Notes

The current baseline was captured at 1280x720 in headless Chrome using SwiftShader/software GL. That is not representative of typical player hardware, so these numbers should be treated as automation baselines and relative hotspot signals. A real hardware pass should rerun the same `?perf=1` route and record `window.perfMonitor.getLevelSummary()` after 10-20 seconds of play per level.

The script loaded each level, skipped the countdown, held forward/boost input, warmed up briefly, then sampled about 6.5 seconds. The FPS averages include occasional level-transition or runtime stalls; p50/p95 frame times are better for comparing sustained pressure.

## Baseline Results

| Level | Avg FPS | p50 ms | p95 ms | Static | Marbles | Particles | Lights | Bodies | Draw Proxy | Transform Proxy | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `tutorial` | 5.93 | 107.22 | 209.94 | 5 | 70 | 17 | 4 | 75 | 110 | 90 | Small level, still dominated by marble sync in software GL. |
| `neon_grid_run` | 8.17 | 112.66 | 159.01 | 11 | 70 | 28 | 6 | 78 | 141 | 102 | Animated neon lights and moving platforms. |
| `ice_bridges_run` | 7.85 | 113.94 | 206.78 | 12 | 70 | 36 | 4 | 80 | 160 | 111 | More moving platforms and particle visuals. |
| `lava_tubes_run` | 8.58 | 106.05 | 218.53 | 15 | 70 | 145 | 7 | 82 | 302 | 141 | Particle-heavy: 5 emitters, 80 particle-system active count, 3 animated lights. |
| `gravity_well_run` | 8.55 | 103.87 | 224.22 | 2 | 70 | 66 | 4 | 82 | 213 | 143 | High transform pressure despite low static geometry. |
| `radiant_reactor_run` | 8.44 | 113.15 | 219.43 | 2 | 70 | 76 | 4 | 74 | 236 | 148 | Reactor visuals add particles plus moving geometry. |
| `nebula_nexus_run` | 8.23 | 105.27 | 205.51 | 1 | 70 | 79 | 4 | 73 | 240 | 158 | Particle and transform pressure, low static count. |
| `space_station` | 3.11 | 124.55 | 229.36 | 19 | 70 | 98 | 4 | 104 | 308 | 193 | Worst sampled level: highest body count and 15 dynamic objects. |
| `neon_pulse_grid_run` | 5.34 | 104.89 | 213.65 | 4 | 70 | 149 | 4 | 73 | 384 | 230 | Highest draw/transform proxy; many visual particles. |

All sampled levels stayed below the 55-60 FPS target in this headless software-rendered environment. That does not prove the same drop on real hardware, but it establishes repeatable hotspots for agent-driven iteration.

## Hot Zones

- `space_station`: highest physics-body pressure (`104`) plus `15` dynamic objects and `193` estimated transform writes per frame.
- `neon_pulse_grid_run`: highest draw-call proxy (`384`), `149` visual particles, and `230` estimated transform writes.
- `lava_tubes_run`: particle-heavy path with `145` active particles, `5` particle emitters, `7` lights, and `3` animated lights.
- `radiant_reactor_run`, `gravity_well_run`, and `nebula_nexus_run`: low static geometry counts, but the 70-marble baseline plus particles and moving features keep transform pressure high.

## Static Batching A/B

Static-box batching is enabled by default on the Filament path and can be disabled with `?staticBatch=0`, `?noStaticBatch`, or `?noBatch`. It keeps Rapier fixed bodies individual, but merges same-material static box visuals into fewer Filament renderables after zone creation. The simple WebGL2 debug renderer bypasses this path.

Headless SwiftShader frame timing stayed noisy and mixed, so use the entity and draw proxy reductions below as the reliable automation signal. Real GPU frame pacing should be captured with the same `?perf=1` route before judging final FPS wins.

| Level | Static Entities Off | Static Entities On | Boxes Batched | Collapsed Entities | Draw Proxy Off | Draw Proxy On |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `ice_bridges_run` | 12 | 5 | 10 | 7 | 116 | 89 |
| `lava_tubes_run` | 15 | 7 | 12 | 8 | 218 | 212 |
| `space_station` | 19 | 2 | 19 | 17 | 209 | 146 |
| `desert_ruins_run` | 14 | 3 | 14 | 11 | 209 | 178 |
| `spiral_madness` | 67 | 4 | 67 | 63 | 252 | 89 |
| `galaxy_spiral_run` | 48 | 4 | 48 | 44 | 258 | 200 |

The most useful reductions are in structural-repeat zones: spiral courses, space station, desert ruins, ice bridges, and lava tubes. `neon_pulse_grid_run`, `gravity_well_run`, and `radiant_reactor_run` have fewer repeated same-material static boxes; their current pressure is mostly particles, moving platforms, dynamic bodies, and marble sync.

## CPU Visual Culling

Lightweight CPU culling is enabled by default on the Filament path. It uses a conservative distance plus camera view-cone sphere test with hysteresis, not an exact Filament frustum query. This keeps nearby/player-adjacent objects visible and reduces pop-in while allowing large/open levels to stop touching off-screen visuals.

Current coverage:

- Static batched box renderables from `staticBatchResources` are temporarily removed from the Filament scene when outside the active view envelope.
- Power-up and collectible visuals keep gameplay/collision checks active, but skip hover/spin transform writes while culled.
- Visual particles keep their lifetime cleanup, but skip expensive per-frame visual updates and scene visibility while far/off-camera.
- The simplified WebGL2 renderer bypasses this culling path so it remains a stable shared-state debug view.

Use `window.cullingStats` or the `?perf=1` overlay to inspect the current frame. Expected fields include `staticHidden`, `staticTotal`, `dynamicHidden`, `dynamicTotal`, `particleHidden`, `particleTotal`, and `visibleEntities`.

For A/B captures, compare `/?renderer=filament&perf=1` with `/?renderer=filament&perf=1&culling=0`. Static culling benefits scale with batching, so test both `staticBatch` defaults and `?staticBatch=0` when isolating where the savings come from.

## Likely Culprits

- `src/game-loop/sync.js` updates all marbles every frame through `TransformManager.getInstance()` and `setTransform()`.
- Visual particles add per-frame JS updates and transform writes; sampled complex zones reached roughly 60-150 active visual particles.
- Dynamic objects and temporary/moving platforms add additional physics bodies and transform writes, especially in `space_station`.
- `src/game-loop/render.js` performs per-frame collectible hover, power-up spin, moving platform, and active effect transforms.
- Lights and animated lights are most visible in neon/lava zones. Filament draw-call counts are not exposed here, so `drawCallsProxy` is a pressure estimate based on renderable objects, particles, and active particle counts.

## Next Baseline Pass

Run the same route on a normal browser/GPU with `?renderer=filament&perf=1`, sample each hot level for 10-20 seconds after loading, and paste `window.perfMonitor.getLevelSummary()` into this report. Use `?renderer=simple&perf=1` when isolating physics/update costs from Filament material and lighting complexity.

## MarblePhysics WASM

### Enablement

WASM loads automatically when `public/wasm/marble_physics.wasm` is present (CI/prod builds). No query flag is required. Use `?wasmPhysics=0` to force pure-JS fallbacks for A/B comparisons. The perf overlay reports the active backend on the `physics:` line.

### Batch routing

| Entity count | Backend when WASM loaded |
| --- | --- |
| `< FORCE_BATCH_THRESHOLD` (8) | Scalar (HEAP out-param on WASM path) |
| `8 … 199` | JS batch (`jsFallback.computeForceFieldsBatch`) |
| `≥ WASM_HEAP_BATCH_MIN` (200) | WASM HEAPF32 batch |

### Node micro-benchmark

Force-field application (black-hole style: inverse-linear falloff, `falloffExp=1`, `minDist=0.5`, `maxDist=25`). Average milliseconds per simulated frame over 200 iterations after 50 warmup iterations.

Run:

```bash
node scripts/benchmark-wasm-bridge.mjs          # JS scalar vs JS batch
node scripts/benchmark-wasm-bridge.mjs --wasm   # includes WASM HEAPF32 batch path
npm run build:wasm                              # required before --wasm
node tests/test_wasm_bridge.js                  # JS fallback parity
node tests/test_wasm_bridge_wasm.js             # WASM vs JS (skips if binary absent)
```

Captured on 2026-07-11 (Node v24.5.0, `/root/marbles` dev host):

| Entities | Scalar JS (ms) | Batch JS (ms) | JS batch speedup | Batch WASM (ms) | WASM vs scalar |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 | 0.017 | 0.010 | 1.66× | 0.042 | 0.40× |
| 200 | 0.023 | 0.027 | 0.86× | 0.010 | 2.40× |
| 1000 | 0.144 | 0.139 | 1.03× | 0.049 | 2.95× |

Notes:

- WASM HEAP batch pays a fixed copy + `_malloc` setup cost; hybrid routing keeps mid-size batches on JS until `WASM_HEAP_BATCH_MIN` (200).
- Scalar WASM uses `*Out` HEAP writers instead of Embind `{x,y,z}` objects for magnet/black-hole paths with ≤8 targets.
- Local dev without emsdk continues to use JS fallbacks silently (`npm run build:wasm` skips gracefully when Emscripten is absent).
- Shared test vectors live in `tests/test_wasm_bridge.js` and `tests/test_wasm_bridge_wasm.js`.

### Frame-time A/B (ability-heavy levels)

Compare WASM vs JS on real hardware (SwiftShader headless timing is not representative):

1. `/?renderer=filament&perf=1` — play 15s on `gravity_well_run` (black holes) and a magnet-active level; record `window.perfMonitor.getLevelSummary().p50FrameMs`.
2. Repeat with `?wasmPhysics=0`.
3. Confirm overlay shows `physics: wasm` vs `physics: js-fallback`.

Expected signal: modest p50 improvement on levels with many simultaneous force-field targets (70 marbles + black holes/magnet), not on geometry-only levels.

## Physics worker A/B (Rapier offload)

Opt in with `?physicsWorker=1` on the **tutorial** level (spike). Requires COOP/COEP (`vite.config.js` / production CDN). Compare against `?physicsWorker=0` on the same level.

Suggested route (isolates physics from Filament):

```text
/?renderer=simple&perf=1&physicsWorker=0   # main-thread Rapier
/?renderer=simple&perf=1&physicsWorker=1   # worker @ 120 Hz (override ?physicsHz=60)
```

After 10–20 s of play, record:

```javascript
window.perfMonitor.getLevelSummary()
// latestSyncWork.physicsStepMs — worker: read from SAB (near 0 on main wait)
// latestSyncWork.mainThreadPhysicsWaitMs — main-thread stall waiting on worker
// latestMetrics.rapierBackend — 'worker' | 'main'
```

Also sample body-pressure and particle-heavy levels (`space_station`, `lava_tubes_run`) on **main-thread** baseline; worker path is tutorial-only until expanded.

**Expected:** main-thread `physicsStepMs` drops when Rapier runs in the worker; marble transform sync in `sync.js` remains on the main thread and is unchanged.

See [architecture/physics-worker.md](./architecture/physics-worker.md).

### quaternionToMat4Batch — go/no-go (2026-07-18)

**Decision: skip.** `src/math.ts` already reuses a shared `_mat4Pool` per synchronous call. The marble sync loop in `src/game-loop/sync.js` interleaves Rapier `translation()`/`rotation()` reads with Filament `setTransform()` writes; a WASM batch would still require copying ~70 quaternions + positions into HEAP and copying 16×N matrices back before `setTransform`. Node force-field benchmarks show HEAP copy overhead dominates below ~200 entities; the same pattern applies here. Revisit only if sync-phase profiling on GPU shows quat→mat4 as >10% of sync ms **and** a prototype batch beats JS after copy costs.

### Spring / segment batch kernels

- `computeSpringForcesBatch` and `closestPointsOnSegmentBatch` ship with JS fallbacks + WASM HEAP paths (same hybrid threshold as force fields).
- Grapple uses scalar `computeSpringForce` via `src/zone-setup/grapple.js` (single spring per frame; batch not warranted yet).
