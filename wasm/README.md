# MarblePhysics WASM Module

A custom C++ WebAssembly module that offloads performance-critical physics math
to native-speed code compiled with [Emscripten](https://emscripten.org/).

## Features

| Function | Description |
|---|---|
| `vec3Distance` | Euclidean distance between two 3-D points |
| `vec3DistanceSq` | Squared distance (cheaper than `vec3Distance` for comparisons) |
| `vec3Dot` | Dot product of two 3-D vectors |
| `vec3Length` | Length (magnitude) of a vector |
| `vec3Normalize` | Normalize a vector to unit length |
| `applyVelocityDamping` | Frame-rate–independent velocity damping + speed cap |
| `computeForceField` | Inverse-power-law attraction / repulsion force field |
| `computeSpringForce` | Hooke's-law spring with velocity damping |
| `reflectVelocity` | Specular velocity reflection off a surface normal |
| `closestPointOnSegment` | Closest point on a line segment (grapple / rail logic) |

## Directory Structure

```
wasm/
├── CMakeLists.txt        Build configuration (Emscripten + Embind)
├── build.sh              One-shot build script → public/wasm/
├── marble_physics.cpp    C++ implementation + Embind exports
└── README.md             This file
```

## Prerequisites

1. **Emscripten SDK** (3.1.x or later)

   ```bash
   git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
   cd ~/emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. **CMake** ≥ 3.20

## Building

```bash
# From the repo root:
npm run build:wasm

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

// Initialize once (e.g. during game init)
await initMarblePhysicsWasm();

// Use anywhere in the game loop
const physics = getMarblePhysics();

// Force field impulse for a black hole
const force = physics.computeForceField(
    bhPos.x, bhPos.y, bhPos.z,   // field origin
    marble.x, marble.y, marble.z, // marble position
    20.0,  // strength (positive = attract)
    1.0,   // falloff exponent
    0.5,   // minimum clamped distance
    25.0   // maximum effective radius
);
body.applyImpulse(force, true);
```

## Adding New Functions

1. Implement the function in `marble_physics.cpp`.
2. Register it in the `EMSCRIPTEN_BINDINGS` block at the bottom of the file.
3. Add a corresponding JS fallback in `src/wasm-bridge.js` under the
   `jsFallback` object.
4. Re-run `npm run build:wasm`.

## Notes

- The module is loaded asynchronously via a dynamic `import()`.  The game
  continues to run with pure-JS fallbacks while loading.
- No `SharedArrayBuffer` or special headers are needed for this module;
  threading is not used.
- The module is built with `-O3`, WebAssembly SIMD (`-msimd128`), fast-math,
  duplicate elimination, and other size/perf flags for the vector math hot path.
  The pure-JS fallbacks remain available when the WASM build is not present.
