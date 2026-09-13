# MarblePhysics WASM Module

A custom C++ WebAssembly module that offloads performance-critical physics math
to native-speed code compiled with [Emscripten](https://emscripten.org/).

## Toolchain pin

| Component | Version | Where |
|-----------|---------|--------|
| **Emscripten** | **3.1.50** | CI (`.github/workflows/debug_build.yml`), devcontainer |
| CMake | ≥ 3.20 | `wasm/CMakeLists.txt` |
| C++ | 17 | `-std=c++17` |

`wasm/build.sh` pins and activates 3.1.50 itself (via `emsdk install`/`activate`)
whenever it can find an emsdk checkout (`$EMSDK`, `/opt/emsdk`,
`/content/build_space/emsdk`, or `/root/emsdk`), so a plain `npm run build:wasm`
already matches CI. To do it manually:

```bash
# Example with emsdk
./emsdk install 3.1.50
./emsdk activate 3.1.50
source ./emsdk_env.sh
npm run build:wasm
```

After editing `wasm/marble_physics.cpp`, always rebuild and commit both
`public/wasm/marble_physics.{js,wasm}`. CI runs `npm run check:wasm` to fail on
stale artefacts.

## Features

| Function | Description |
|---|---|
| `vec3Distance` / `vec3DistanceSq` | Euclidean distance helpers |
| `vec3Dot` / `vec3Length` / `vec3Normalize` | Vector math |
| `applyVelocityDamping` / `*Out` / `Batch` | Frame-rate–independent damping + speed cap (Batch is SIMD128-vectorized) |
| `computeForceField` / `*Out` / `Batch` | Inverse-power-law attraction / repulsion (Batch is SIMD128-vectorized) |
| `computeSpringForce` / `*Out` / `Batch` | Hooke's-law spring with velocity damping |
| `reflectVelocity` / `*Out` | Specular velocity reflection |
| `closestPointOnSegment` / `*Out` / `Batch` | Nearest point on a segment (grapple / rails) |

Prefer `*Out` and batch APIs from game code — they avoid Embind object allocation
and cross the JS/WASM boundary with `HEAPF32` copies only when
`count >= WASM_HEAP_BATCH_MIN` (200). Scalar game loops use `compute*Into` with a
reusable `Float32Array(3)` scratch buffer.

## Directory Structure

```
wasm/
├── CMakeLists.txt        Build configuration (Emscripten + Embind)
├── build.sh              One-shot build script → public/wasm/
├── marble_physics.cpp    C++ implementation + Embind exports
└── README.md             This file
```

## Prerequisites

1. **Emscripten SDK 3.1.50** (or compatible 3.1.x)

   ```bash
   git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
   cd ~/emsdk
   ./emsdk install 3.1.50
   ./emsdk activate 3.1.50
   source ./emsdk_env.sh
   ```

2. **CMake** ≥ 3.20

## Building

```bash
# From the repo root:
npm run build:wasm
npm run check:wasm          # fail if cpp newer than public/wasm

# Or directly:
cd wasm && ./build.sh

# Debug + AddressSanitizer build, for local testing only:
cd wasm && ./build.sh --debug
```

Output files are written to `public/wasm/`:
- `marble_physics.js`   — Emscripten-generated JS glue code
- `marble_physics.wasm` — Compiled WebAssembly binary

`./build.sh --debug` builds with `-O0 -g -fsanitize=address -Weverything` into
`wasm/build-debug/` instead (not copied to `public/wasm/`) so a Release build
is never accidentally shipped with sanitizer instrumentation. Unlike the
Release build it also allows the `node` environment (`-sENVIRONMENT` includes
`node`, not just `web,worker`), so it can be loaded directly under Node —
write a small script that `import()`s `wasm/build-debug/marble_physics.js`
with `wasmBinary`/`locateFile` pointed at that directory (same pattern
`tests/test_wasm_bridge_wasm.js` uses for the Release build) and call the
batch/scalar functions directly to exercise them under ASan.

## JavaScript Usage

The module is consumed through `src/wasm-bridge.js`, which provides
automatic fallback to pure-JS implementations when the WASM binary is
not available:

```javascript
import { initMarblePhysicsWasm, getMarblePhysics } from './wasm-bridge.js';

await initMarblePhysicsWasm();
const physics = getMarblePhysics();

// Prefer Into (no object alloc) for scalar hot paths:
const scratch = new Float32Array(3);
physics.computeForceFieldInto(scratch, bhX, bhY, bhZ, mx, my, mz, 20, 1, 0.5, 25);
body.applyImpulse({ x: scratch[0], y: scratch[1], z: scratch[2] }, true);

// Batched path when entity count > FORCE_BATCH_THRESHOLD (8); WASM HEAP path ≥ 200
physics.computeForceFieldsBatch(positions, strengths, outForces, count, ...);
```

Benchmark: `node scripts/benchmark-wasm-bridge.mjs [--wasm]` (see `docs/PERFORMANCE_BASELINE.md`).

WASM loads by default when `public/wasm/marble_physics.wasm` exists. Use `?wasmPhysics=0` to force JS fallbacks for A/B testing. The perf overlay (`?perf=1`, F2) shows `physics: wasm | js-fallback | pending`.

## Tests

```bash
npm run test:wasm:parity    # C++ vs JS fallbacks (requires built wasm)
npm run test:unit           # check:wasm + parity + all unit tests

# Throughput benchmark for the SIMD batch kernels (1000 entities):
node tests/benchmark_wasm_batch_simd.mjs
# ...or compare against a previously built binary (e.g. checked out from git
# history before a WASM perf change) to measure improvement:
node tests/benchmark_wasm_batch_simd.mjs --baseline-dir /path/to/old/public/wasm
```

## Adding New Functions

1. Implement the function in `marble_physics.cpp` (+ `*Out` / `Batch` variants when hot).
2. Register in the `EMSCRIPTEN_BINDINGS` block.
3. Add JS fallback(s) in `src/wasm-bridge.js` under `jsFallback`.
4. Add parity tests in `tests/test_wasm_bridge.js` and `tests/test_wasm_bridge_wasm.js`.
5. `npm run build:wasm` and commit `public/wasm/*`.

## Link flags (release)

See `wasm/CMakeLists.txt`:

- `-O3`, `-msimd128`, `-ffast-math`, `-sASSERTIONS=0`
- `-sMODULARIZE=1` + `EXPORT_NAME=MarblePhysicsModule`
- `INITIAL_MEMORY=32MB`, `ALLOW_MEMORY_GROWTH=1`
- `--closure 1` minifies the JS glue (~31 KB → ~15 KB raw, ~9 KB → ~6 KB
  gzipped). Verified compatible with Embind + `MODULARIZE` + `EXPORT_ES6` in
  this project's configuration — Embind attaches its exports via
  string-keyed assignment (`Module["name"] = ...`), which Closure's default
  `SIMPLE_OPTIMIZATIONS` level never renames, so no extra `extern "C"` export
  shim is needed. Re-run `npm run test:wasm:parity` after touching link flags
  to catch a regression here.

Debug builds (`./build.sh --debug`) instead use `-O0 -g -fsanitize=address
-sASSERTIONS=2` with no `--closure`, and permit the `node` environment — see
"Building" above.

## Notes

- Loaded asynchronously via dynamic `import()`. JS fallbacks run until WASM is ready.
- No `SharedArrayBuffer` required for this module (unlike the Rapier physics worker).
- Do not move Rapier body iteration or Filament transforms into C++ — numeric kernels only.
- `computeForceFieldsBatch` and `applyVelocityDampingBatch` vectorize 4 entities
  at a time with WASM SIMD128 (`#ifdef __wasm_simd128__`, scalar fallback
  otherwise). Positions/velocities are stored AoS (interleaved xyz per
  entity); since WASM SIMD128 has no strided-gather instruction, `loadVec3x4`/
  `storeVec3x4` deinterleave/reinterleave 4 vec3s (12 contiguous floats = 3
  `v128` words) via shuffles rather than gathering lane-by-lane. `std::pow`
  has no SIMD128 intrinsic for a runtime-variable exponent, so
  `computeForceFieldsBatch`'s falloff term is computed per-lane and folded
  back into the otherwise fully-vectorized pipeline. A non-multiple-of-4
  remainder always falls back to the scalar kernel.
