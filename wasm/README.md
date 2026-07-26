# MarblePhysics WASM Module

A custom C++ WebAssembly module that offloads performance-critical physics math
to native-speed code compiled with [Emscripten](https://emscripten.org/).

## Toolchain pin

| Component | Version | Where |
|-----------|---------|--------|
| **Emscripten** | **3.1.50** | CI (`.github/workflows/debug_build.yml`), devcontainer |
| CMake | ≥ 3.20 | `wasm/CMakeLists.txt` |
| C++ | 17 | `-std=c++17` |

Use the same Emscripten major/minor when building locally so `public/wasm/` parity
tests match CI:

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
| `applyVelocityDamping` / `*Out` / `Batch` | Frame-rate–independent damping + speed cap |
| `computeForceField` / `*Out` / `Batch` | Inverse-power-law attraction / repulsion |
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
```

Output files are written to `public/wasm/`:
- `marble_physics.js`   — Emscripten-generated JS glue code
- `marble_physics.wasm` — Compiled WebAssembly binary

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
- `--closure 1` is **commented out** — test carefully before enabling (can break Embind).

## Notes

- Loaded asynchronously via dynamic `import()`. JS fallbacks run until WASM is ready.
- No `SharedArrayBuffer` required for this module (unlike the Rapier physics worker).
- Do not move Rapier body iteration or Filament transforms into C++ — numeric kernels only.
