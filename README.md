# Marbles 3D Game

A 3D marble roller game using Google Filament (WASM) and Rapier3D-Compat for physics simulation.

## Features

- **Physics Engine**: Rapier3D-Compat with gravity set to -9.81
- **3D Rendering**: Google Filament (WASM-based) for high-performance rendering
- **Custom WASM Module**: Native-speed C++ physics helpers (force fields, velocity damping, spring forces, vector math) via Emscripten
- **Static Floor**: Large floor plane for marbles to roll on
- **Dynamic Marbles**: Multiple sphere objects with physics properties (restitution, friction)
- **Transform System**: Helper function to convert quaternion rotations to 4x4 transformation matrices
- **Game Loop**: Synchronized physics stepping and rendering

## Project Structure

```
marbles/
├── index.html          # Main HTML file
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration with CORS headers
├── wasm/               # C++ WebAssembly physics module (Emscripten)
│   ├── marble_physics.cpp   # C++ source with Embind exports
│   ├── CMakeLists.txt       # Emscripten build config
│   ├── build.sh             # Build script → public/wasm/
│   └── README.md            # Build instructions
└── src/
    ├── main.js         # Main game logic
    └── wasm-bridge.js  # JS façade for the WASM module (+ pure-JS fallbacks)
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. (Optional) Build the C++ WASM physics module:
```bash
npm run build:wasm    # requires Emscripten SDK — see wasm/README.md
```

The game runs fully without the WASM binary; `src/wasm-bridge.js` falls back to
equivalent pure-JavaScript implementations automatically.

## Implementation Details

### Custom C++ WASM Module

The `wasm/` directory contains a focused C++ module built with Emscripten + Embind.
It provides high-performance helpers that complement Rapier3D:

| Function | Description |
|---|---|
| `vec3Distance` / `vec3DistanceSq` | 3-D distance helpers |
| `vec3Dot` / `vec3Length` / `vec3Normalize` | Vector math |
| `applyVelocityDamping` | Frame-rate–independent damping + speed cap |
| `computeForceField` | Inverse-power-law attraction / repulsion |
| `computeSpringForce` | Hooke's-law spring with damping |
| `reflectVelocity` | Specular velocity reflection off a surface |
| `closestPointOnSegment` | Nearest point on a segment (grapple / rails) |

The JS bridge (`src/wasm-bridge.js`) exposes a unified API:

```javascript
import { initMarblePhysicsWasm, getMarblePhysics } from './wasm-bridge.js';

await initMarblePhysicsWasm();          // called once during init (non-blocking)
const physics = getMarblePhysics();     // returns WASM or JS impl transparently

const force = physics.computeForceField(
    blackHole.x, blackHole.y, blackHole.z,
    marble.x, marble.y, marble.z,
    20.0, 1.0, 0.5, 25.0
);
```

### Physics Setup
- Rapier3D-Compat physics world with gravity (-9.81 m/s²)
- Static floor: Fixed rigid body with cuboid collider (100x1x100 units)
- Dynamic marbles: Sphere colliders with:
  - Radius: 0.5 units
  - Restitution: 0.7 (bounciness)
  - Friction: 0.5

### Rendering
- Filament Engine for WebGL2 rendering
- Camera positioned at (0, 10, 20) looking at origin
- Entities synchronized with physics rigid bodies
- Optional simplified WebGL2 debug renderer via `?renderer=simple`, `?renderer=webgl`, or the in-page renderer toggle
- Optional FPS/performance overlay via `?fps=1`, `?perf=1`, or `F2`; see `docs/PERFORMANCE_BASELINE.md`
- Static box visuals are batched by default on the Filament path; use `?staticBatch=0` for before/after checks
- Lightweight CPU culling is enabled by default on the Filament path; use `?culling=0` or `?noCulling` for before/after checks

### Transform System
The `quaternionToMat4()` helper function converts Rapier's quaternion rotations and positions into column-major 4x4 transformation matrices for Filament:

```javascript
function quaternionToMat4(position, quaternion) {
  // Converts quaternion (x, y, z, w) and position to 16-float array
  // Returns column-major 4x4 matrix for Filament
}
```

### Game Loop
1. **Physics Step**: `world.step()` advances physics simulation
2. **Transform Update**: Extract rigid body position/rotation, convert to Mat4
3. **Entity Update**: Apply transforms to Filament entities
4. **Render**: Filament renders the frame

## Dependencies

- **vite**: ^7.3.1 - Build tool and dev server
- **filament**: ^1.51.5 - Google's physically based rendering engine
- **@dimforge/rapier3d-compat**: ^0.13.0 - Physics engine
- **Emscripten** (dev, optional) - Compiles `wasm/marble_physics.cpp` to WASM

## Browser Requirements

- WebGL2 support
- WASM support  
- Cross-Origin isolation for SharedArrayBuffer (COOP/COEP headers configured in Vite)

## Notes

- Filament uses a UMD/WASM loading pattern which may require additional configuration in some environments
- The physics simulation runs independently and can be tested even if Filament rendering is unavailable
- Use `?renderer=simple` for a lightweight shared-state WebGL2 view that draws level geometry and live marble positions without Filament materials/post-processing. Runtime breadcrumbs include `window.rendererType`, `window.usingSimpleRenderer`, and `window.rendererFallbackReason`.
- See `docs/RENDERER_FALLBACK.md` for renderer toggle usage and debugging guidance.
- Use `?perf=1` or `?fps=1` to show the FPS/frame-time overlay and expose `window.perfMonitor` summaries for level baseline captures. See `docs/PERFORMANCE_BASELINE.md`.
- Use `?culling=0` or `?noCulling` to disable the conservative distance/view-cone culler when checking pop-in, static batch visibility, or dynamic visual updates.
- Console logs show marble positions updating as physics simulation runs
- Build the WASM module with `npm run build:wasm` (requires Emscripten); see `wasm/README.md`
