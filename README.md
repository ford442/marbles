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

## Project status

See **[docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)** for the full health dashboard. Snapshot:

| Area | Status | Link |
|------|--------|------|
| Shipped levels | 14 JSON maps via manifest | [level-pipeline.md](docs/architecture/level-pipeline.md) |
| Dev levels | ~58 via `?devLevels=1` | same |
| Phase A | Game loop consolidated in `src/game-loop/` | [architecture README](docs/architecture/README.md) |
| Phase B | Started — `PhysicsWorld`, `InputSystem`, `MarbleRegistry` | same |
| Phase C | In progress — pilot `.ts` systems + `@ts-check` state | [language-strategy.md](docs/architecture/language-strategy.md) |
| Multiplayer | Party relay optional | [multiplayer.md](docs/multiplayer.md) |
| Backend | Optional cloud sync (not required to play) | [backend/README.md](backend/README.md) |
| CI | Assets + unit + lint + typecheck + WASM build | [.github/workflows/debug_build.yml](.github/workflows/debug_build.yml) |
| E2E | Optional smoke job (`continue-on-error`) | [tests/e2e/smoke.cjs](tests/e2e/smoke.cjs) |

Active repo layout: **[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)**.

### Documentation

- [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) — health checklist and migration status
- [docs/architecture/README.md](docs/architecture/README.md) — Phase A/B/C ADR and ownership map
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — assets, zones, validation
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — runtime entry graph
- [LIGHTING_SYSTEM_GUIDE.md](LIGHTING_SYSTEM_GUIDE.md) — zone lighting API
- [PARTICLE_INTEGRATION_GUIDE.md](PARTICLE_INTEGRATION_GUIDE.md) — CPU particle system
- [docs/backups/](docs/backups/README.md) — archived code (intentional; not runtime)

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

### Experimental WebGPU particles

Filament stays on WebGL2. Optional WebGPU compute handles up to **8192** particles on a transparent overlay canvas.

```
npm run dev
# open http://localhost:5173/?webgpuParticles=1
# benchmark burst: ?webgpuParticles=1&webgpuStress=1
```

See **[docs/WEBGPU_PARTICLES.md](docs/WEBGPU_PARTICLES.md)** for architecture, flags, and fallback behavior.
The archived C++ Dawn experiment is **not** used — see `docs/backups/experimental-wasm-renderer/ARCHIVED.md`.

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

### Runtime (game bundle)

| Package | Role |
|---------|------|
| `filament` | WebGL2 renderer (WASM UMD) |
| `@dimforge/rapier3d-compat` | Physics simulation |

The game intentionally does **not** use three.js or React in the shipped bundle. See [docs/architecture/language-strategy.md](docs/architecture/language-strategy.md).

### Dev / build

- **vite**: ^7.3.1 — build tool and dev server
- **playwright**, **eslint**, **typescript**, etc. — see `package.json` devDependencies
- **Emscripten** (optional) — compiles `wasm/marble_physics.cpp` to WASM

## Browser Requirements

- WebGL2 support
- WASM support  
- Cross-Origin isolation for SharedArrayBuffer (COOP/COEP headers configured in Vite)

## Production Deploy

### Build

`npm run build` runs `npm run build:wasm` first, then Vite. The WASM artifacts are copied into `public/wasm/` by `wasm/build.sh` and emitted into `dist/wasm/` by the build. `public/wasm/` is gitignored, so a clean checkout **must** run `npm run build` (or `npm run build:wasm`) before deploy.

### Cross-origin isolation headers

SharedArrayBuffer requires:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

`vite dev` and `vite preview` set these automatically. For static hosts, add them at the server/CDN layer.

**nginx**

```nginx
location / {
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    try_files $uri $uri/ /index.html;
}
```

**Cloudflare Pages**

Add to `_headers` in the publish directory:

```
/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
```

**Note:** `require-corp` blocks cross-origin resources that do not send `Cross-Origin-Resource-Policy` (or use `crossorigin` attributes). Self-hosted Filament/WASM assets under the same origin are unaffected.

### Cache-Control strategy

| Asset type | Example | Cache policy |
|---|---|---|
| Hashed JS/CSS | `dist/assets/index-BJvUM3Bn.js` | `public, max-age=31536000, immutable` |
| Unhashed WASM | `dist/wasm/marble_physics.wasm` | `public, max-age=3600` or version with query/hash |
| Filament WASM | `dist/filament.wasm` | `public, max-age=3600` or version with query/hash |
| HTML | `dist/index.html` | `no-cache` |

Because `marble_physics.js` and `filament.wasm` keep stable filenames, either:

1. Bust the cache on each deploy (e.g., append `?v=<git-sha>` in the loader), or
2. Configure your CDN to invalidate `/wasm/*` and `/*.wasm` on every deploy.

Vite handles hashed JS/CSS automatically; do **not** set long cache headers on `index.html`.

### Deploy checklist

- [ ] `npm run build` completed successfully (includes `build:wasm`)
- [ ] `dist/wasm/marble_physics.js` and `dist/wasm/marble_physics.wasm` exist
- [ ] COOP/COEP headers are present on the live origin
- [ ] `index.html` is served with `Cache-Control: no-cache` or short TTL
- [ ] WASM/assets have an explicit cache invalidation strategy
- [ ] Verify `/wasm/marble_physics.wasm` returns HTTP 200 and `application/wasm`

## Notes

- Filament uses a UMD/WASM loading pattern which may require additional configuration in some environments
- The physics simulation runs independently and can be tested even if Filament rendering is unavailable
- Use `?renderer=simple` for a lightweight shared-state WebGL2 view that draws level geometry and live marble positions without Filament materials/post-processing. Runtime breadcrumbs include `window.rendererType`, `window.usingSimpleRenderer`, and `window.rendererFallbackReason`.
- See `docs/RENDERER_FALLBACK.md` for renderer toggle usage and debugging guidance.
- Use `?perf=1` or `?fps=1` to show the FPS/frame-time overlay and expose `window.perfMonitor` summaries for level baseline captures. See `docs/PERFORMANCE_BASELINE.md`.
- Use `?culling=0` or `?noCulling` to disable the conservative distance/view-cone culler when checking pop-in, static batch visibility, or dynamic visual updates.
- Console logs show marble positions updating as physics simulation runs
- Build the WASM module with `npm run build:wasm` (requires Emscripten); see `wasm/README.md`
