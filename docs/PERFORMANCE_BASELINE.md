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

- `src/game-loop/sync.ts` updates all marbles every frame through `TransformManager.getInstance()` and `setTransform()`.
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
- Scalar WASM uses `*Out` / `compute*Into` HEAP writers instead of Embind `{x,y,z}` objects for magnet/black-hole paths with ≤8 targets.
- Game hot paths using `computeForceFieldInto` / `computeSpringForceInto`: `effects-tick.js`, `frame-input.js` (magnet), `ability-sync.js` (remote black holes), `zone-setup/grapple.js` (spring).
- Game hot paths using `computeForceFieldsBatch` above `FORCE_BATCH_THRESHOLD`: `effects-tick.js` (black hole), `frame-input.js` (magnet), `game-loop/repel-pulse.js` (Shield + Violet Light, `falloffExp=0` constant-magnitude repel).
- CI: `npm run build:wasm` → `check:wasm` → `git diff --exit-code public/wasm/` (the build is byte-reproducible, so committed artefacts must match the C++) → `test:wasm:parity` → Debug/ASan compile smoke, before unit tests (Emscripten **3.1.50** — see `wasm/README.md`).
- Local dev without emsdk continues to use JS fallbacks silently (`npm run build:wasm` skips gracefully when Emscripten is absent).
- Shared test vectors live in `tests/test_wasm_bridge.js` and `tests/test_wasm_bridge_wasm.js`; the float32 ULP bound against the JS fallbacks lives in `tests/test_wasm_parity_ulp.js` (both run by `npm run test:wasm:parity`).

### Frame-time A/B (ability-heavy levels)

Compare WASM vs JS on real hardware (SwiftShader headless timing is not representative):

1. `/?renderer=filament&perf=1` — play 15s on `gravity_well_run` (black holes) and a magnet-active level; record `window.perfMonitor.getLevelSummary().p50FrameMs`.
2. Repeat with `?wasmPhysics=0`.
3. Confirm overlay shows `physics: wasm` vs `physics: js-fallback`.

Expected signal: modest p50 improvement on levels with many simultaneous force-field targets (70 marbles + black holes/magnet), not on geometry-only levels.

## Physics worker A/B (Rapier offload)

The worker is **default-on** for capable desktops on any **manifest** campaign level (44 maps in `assets/manifest.json`). Requires COOP/COEP (`vite.config.js` / production CDN). Compare against `?physicsWorker=0` on the same level.

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

Sample levels:

| Level | Why |
|-------|-----|
| `tutorial` | Spike baseline |
| `space_station` | High static body count |
| `mushroom_hop` | Factory stamp (manifest) |
| `lava_tubes_run` (`?devLevels=1`) | Particle-heavy; worker still offloads Rapier only |

**Expected on real hardware:** main-thread `physicsStepMs` drops when Rapier runs in the worker; marble transform sync in `sync.js` remains on the main thread. SwiftShader headless timings are not representative — capture notes from a discrete-GPU machine when updating this table.

E2E: `npm run test:e2e:smoke:worker` (forced worker) and `npm run test:e2e:smoke:main` (kill switch), with dev server on :5173.

**Default-on soak (2026-10-17): pending.** Real-GPU numbers for `physicsBackend`, `physicsStepMs`, `mainThreadPhysicsWaitMs` across the 44 manifest ids have not been recorded yet.

See [architecture/physics-worker.md](./architecture/physics-worker.md).

### quaternionToMat4Batch — go/no-go (2026-07-18)

**Decision: skip.** `src/math.ts` already reuses a shared `_mat4Pool` per synchronous call. The marble sync loop in `src/game-loop/sync.ts` interleaves Rapier `translation()`/`rotation()` reads with Filament `setTransform()` writes; a WASM batch would still require copying ~70 quaternions + positions into HEAP and copying 16×N matrices back before `setTransform`. Node force-field benchmarks show HEAP copy overhead dominates below ~200 entities; the same pattern applies here. Revisit only if sync-phase profiling on GPU shows quat→mat4 as >10% of sync ms **and** a prototype batch beats JS after copy costs.

### Spring / segment batch kernels

- `computeSpringForcesBatch` and `closestPointsOnSegmentBatch` ship with JS fallbacks + WASM HEAP paths (same hybrid threshold as force fields). Since 2026-10-05 both are SIMD128 (4 entities per iteration via `loadVec3x4`/`storeVec3x4`, scalar remainder for `count % 4`); parity is covered at 13 entities incl. coincident spring endpoints and zero-length segments.
- No gameplay caller yet: grapple is one spring per local player (`src/zone-setup/grapple.js` keeps scalar `computeSpringForceInto`), and there is no rail-slide / per-frame segment projection. Wire them in when a multi-entity path exists (e.g. remote-player grapples).

`npm run bench:wasm:batch -- --baseline-dir <pre-change public/wasm>` (1000 entities, includes the JS↔HEAP copies, min of 40 interleaved samples), 2026-10-05, Node v24:

| Kernel | Before (ms) | After (ms) | Change |
| --- | ---: | ---: | ---: |
| `computeSpringForcesBatch` | 0.0129 | 0.0081 | −37% |
| `closestPointsOnSegmentBatch` | 0.0112 | 0.0075 | −33% |
| `computeForceFieldsBatch` | 0.0206 | 0.0221 | noise (±9% across runs) |
| `applyVelocityDampingBatch` | 0.0042 | 0.0044 | noise (±5% across runs) |

### WASM build flags (Release)

Each flag was added cumulatively on top of the SIMD spring/segment kernels, built with Emscripten 3.1.50, and kept only if `npm run test:wasm:parity` passed and the JS glue did not grow. Sizes are bytes, raw / `gzip -9`.

| Step | `marble_physics.js` | `marble_physics.wasm` | Kept? |
| --- | ---: | ---: | --- |
| Committed before this change (scalar spring/segment) | 14,766 / 6,323 | 21,974 / 9,468 | — |
| + SIMD spring/segment kernels | 14,766 / 6,323 | 23,728 / 9,937 | yes |
| + `-msimd128` on link line | 14,766 / 6,323 | 23,728 / 9,937 | yes (no change today; required if codegen ever moves to link time) |
| + `-flto` (compile + link) | 14,781 / 6,332 | 23,792 / 9,929 | **no** — single TU, nothing to inline across; glue +15 B |
| + `-sFILESYSTEM=0` | no change | no change | yes (guard) |
| + `-sSUPPORT_LONGJMP=0` | no change | no change | yes (guard) |
| + `-sMALLOC=emmalloc` | no change | −4,742 / −1,930 | yes |
| + `-mnontrapping-fptoint` | no change | no change | yes (no float→int in hot loops today) |
| + `-sMAXIMUM_MEMORY=64 MB` | −4 / +3 | −1 / −1 | yes |
| + `-sSTRICT=1` (drops legacy `ELIMINATE_DUPLICATE_FUNCTIONS`) | byte-identical | byte-identical | yes (guard) |
| **Final** | **14,762 / 6,326** | **18,921 / 8,007** | |

Net vs. the previous committed build: wasm −14% raw / −15% gzip, glue −4 B, with two more SIMD kernels. The Debug/ASan target (`npm run build:wasm:debug`) compiles but is not `-Weverything`-clean (raw-pointer `-Wunsafe-buffer-usage`, Embind `-Wmissing-prototypes` / `-Wglobal-constructors`), so CI runs it as a compile smoke without `-Werror`.

### Float semantics: `-ffast-math` removed (2026-11-22)

Release was `-O3 -ffast-math`. It is now `-O3 -fno-math-errno -fno-trapping-math -ffp-contract=off`: every float32 operation is correctly rounded, NaN and infinity follow IEEE 754, and nothing is reassociated, so the kernels compute the same bits on every machine and stay within a fixed distance of the JS fallbacks. `-fno-math-errno` and `-fno-trapping-math` are the parts of fast-math that cost nothing in correctness. `-ffp-contract=off` rules out fused multiply-add if relaxed-simd is ever enabled; it changes the binary but not the results today.

Size (Emscripten 3.1.50, bytes raw / `gzip -9`):

| Build | `marble_physics.js` | `marble_physics.wasm` |
| --- | ---: | ---: |
| `-ffast-math` | 14,762 / 6,326 | 18,921 / 8,007 |
| strict | 14,762 / 6,326 | 19,000 / 8,006 |

Speed: `npm run bench:wasm:batch -- --baseline-dir <fast-math public/wasm>` (1000 entities, min of 40 interleaved samples, three runs, Node v22.23.5, 4 cores). The benchmark now also times the scalar `*Out` entry points (one call per entity), which is where a compiler flag could matter; the batch kernels are hand-written SIMD.

| Kernel | `-ffast-math` (ms) | strict (ms) | Change across runs |
| --- | ---: | ---: | --- |
| `computeForceFieldsBatch` | 0.0129–0.0132 | 0.0130–0.0132 | within ±1% (noise) |
| `applyVelocityDampingBatch` | 0.0024 | 0.0024–0.0025 | within ±2% (noise) |
| `computeSpringForcesBatch` | 0.0045–0.0046 | 0.0046 | within ±1% (noise) |
| `closestPointsOnSegmentBatch` | 0.0047–0.0049 | 0.0048 | within ±2% (noise) |
| `computeForceFieldOut` × 1000 (`falloffExp = 2`) | 0.0485–0.0490 | 0.0439–0.0445 | **8.5–9.4% faster**, repeatable; cause not investigated |
| `applyVelocityDampingOut` × 1000 | 0.0235–0.0249 | 0.0233–0.0249 | within ±1% (noise) |
| `computeSpringForceOut` × 1000 | 0.0508–0.0519 | 0.0509–0.0519 | within ±1% (noise) |
| `closestPointOnSegmentOut` × 1000 | 0.0397–0.0428 | 0.0392–0.0425 | within ±1.5% (noise) |

Dropping `-ffast-math` costs no measurable speed.

Parity with the JS fallbacks, from `node tests/test_wasm_parity_ulp.js --report`. Error is in float32 ULPs of the magnitude of the terms each kernel adds up, over 20,000 seeded samples per scalar kernel and batches of 1–257 entities:

| Kernel | Max ULP, `-ffast-math` | Max ULP, strict | Bound in the test |
| --- | ---: | ---: | ---: |
| `vec3Distance` | 2.00 | 2.00 | 4 |
| `vec3DistanceSq` | 3.58 | 3.58 | 8 |
| `vec3Dot` | 1.99 | 1.99 | 4 |
| `vec3Length` | 1.35 | 1.35 | 4 |
| `vec3Normalize` | 2.78 | 2.78 | 6 |
| `computeDopplerRate` | 1.98 | 1.98 | 4 |
| `applyVelocityDamping` (+ batch) | 2.00 | 2.00 | 4 |
| `computeForceField` | 11.95 | 13.94 | 24 |
| `computeForceFieldsBatch` | 9.00 | 8.00 | 24 |
| `computeSpringForce` | 3.98 | 3.98 | 8 |
| `computeSpringForcesBatch` | 5.81 | 5.81 | 12 |
| `reflectVelocity` | 5.99 | 5.99 | 12 |
| `closestPointOnSegment` | 5.96 | 5.96 | 12 |
| `closestPointsOnSegmentBatch` | 5.56 | 5.56 | 12 |

On finite inputs the two builds are equally close to the fallbacks; the force field is the loosest because `pow(dist, falloffExp)` multiplies the distance's rounding error by the exponent. What the flag changes is non-finite inputs. With `-ffast-math`, a NaN component made `vec3Normalize` return a zero vector (JS: NaN) and made `applyVelocityDamping` return NaN in all three components (JS: only the NaN one), because the compiler was allowed to assume the comparisons guarding those paths never see a NaN. The strict build matches the fallbacks in all 189 NaN / ±Infinity cases. Separately, the SIMD batch kernels masked out a NaN distance where the scalar kernels and the fallbacks propagate it; they now use the scalar predicates. `vec3Normalize`'s JS cut-off (1e-8) was also aligned with the C++ one (1e-6).

The bound does not cover inputs within rounding distance of a kernel's cut-off (`maxDist`, the 1e-6 zero-length guards), where float32 and float64 can take different branches.

## Bundle: Rapier 0.21 (2026-11-22)

Rapier's WASM grew from 1.5 MB (0.13.1) to 3.1 MB (0.21.0, which added soft bodies). `@dimforge/rapier3d-compat` inlines it as base64, once in the main bundle and once in the physics-worker bundle.

| Chunk | Rapier 0.13.1 | Rapier 0.21.0 | gzip (0.21.0) |
| --- | ---: | ---: | ---: |
| entry (`index-*.js`) | 2,700 KB (Rapier inlined) | 633 KB (game code only) | 175 KB |
| `rapier-*.js` (new, own chunk) | — | 4,334 KB | 1,652 KB |
| `physics-worker-*.js` | about 2,100 KB | 4,354 KB | 1,659 KB |

`rapier3d-compat` alone is 2,070 KB / 763 KB gzip at 0.13.1 and 4,340 KB / 1,653 KB gzip at 0.21.0, so a first visit downloads about 0.9 MB more (gzip), and twice that on desktops that start the worker. Rapier is split into its own chunk (`manualChunks` in `vite.config.js`) so returning players keep it cached across game releases. `scripts/bundle-budget.json` budgets the three chunks separately. Rapier 0.19.3, the last release before soft bodies, is 2,239 KB / 834 KB gzip if the size ever has to come back down.

