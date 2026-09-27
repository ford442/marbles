# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Marbles 3D** is a browser-based 3D marble roller game using Google Filament for rendering and Rapier3D-Compat for physics simulation. The game features multiple themed zones/levels, various marble types, interactive HUD systems, and ability-based gameplay mechanics.

## Quick Start

### Build & Development
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build
npm run build:wasm       # (optional) Compile the C++ WASM physics module
```

The dev server runs on port 5173 with CORS headers pre-configured for WebGL and SharedArrayBuffer.

### Entry Point
`src/main.js` - Initializes the MarblesGame class and orchestrates all game systems.

## Architecture

### Core Game Class (main.js)
The `MarblesGame` class is the central hub that manages:
- Canvas and Filament rendering engine
- Physics world (Rapier3D)
- Game state (marbles, platforms, collectibles, etc.)
- HUD and input systems
- Game loop execution

Phase B subsystems (`PhysicsWorld`, `InputSystem`, `MarbleRegistry`, `AbilitySystem`, `RenderPipeline`, `HudController`, `LevelLoader`) are composed classes that `main.js` delegates to; remaining legacy slices are attached through closed `install*Methods` allowlists. See `docs/architecture/README.md`.

### Game Systems (Mixins)

**Physics & Rendering**
- `game/systems/physics-world.ts` - Creates rigid bodies, colliders, and entities (`PhysicsWorld`); `game/systems/physics-backend.ts` selects main-thread vs worker Rapier
- `game-loop/sync.js` - Synchronizes physics state with Filament entities (driven by `RenderPipeline`)
- `game/systems/render-pipeline.ts` - Frame ordering and Filament draw (`RenderPipeline`)

**Game Logic**
- `game-logic/` - Core gameplay systems (win conditions, checkpoints, collectibles)
- `game-loop/` - Main game loop orchestration
- `abilities/` + `game/systems/ability-system.ts` - Special abilities (bombs, missiles, black holes, holo platforms)

**Input & UI**
- `game/systems/input-system.ts` - Marble movement and camera control (`InputSystem`)
- `hud-manager.ts` + `game/systems/hud-controller.ts` - HUD rendering and state display (`HUDManager` is typed against a narrow `HudHost`)
- `game/systems/marble-registry.js` - Marble spawning and lifecycle (`MarbleRegistry`)

**GPU Chores** (`src/gpu-chores/`)
- Reusable, app-agnostic GPU jobs: `reduce_f32`, `compact_f32`, `batched_distance`
- Single entry point: `runJob({ op, prefer: 'auto' })`; backends are WebGPU → WASM/JS
- Adopts the particle backend's device — it never calls `requestDevice()` itself
- Kill switch `?no_gpu_compute`; breadcrumbs on `window.gpuChoresBreadcrumbs`
- Domain compute (particle integrate, noise, marble physics) stays outside this module
- See `docs/GPU_CHORES.md`

**Zones & Initialization**
- `zone-setup/` - Zone loading and setup
- `zones/` - Individual zone implementations (50+ levels)
- `zones/methods/` - Zone utility functions
- `init/` - Filament engine initialization and asset loading

### Asset System

**Asset Directories** (`assets/`)
- `maps/` - Zone/level definitions
- `marbles/` - Marble definitions
- `materials/` - Material configurations
- `sounds/` - Audio definitions
- `schemas/` - JSON schema validation

**Contributing Assets**: See `docs/CONTRIBUTING.md` for detailed guidelines on creating new:
- Maps/Zones
- Marbles
- Sounds

### Rendering Pipeline

**Filament Integration** (WebGL2/WASM)
- Loaded via UMD pattern in `src/init/`
- Requires COOP/COEP headers for SharedArrayBuffer (configured in vite.config.js)
- Assets (GLTF, materials) loaded through Filament's asset pipeline
- Transform matrices sync physics positions to render entities

**Materials System** (`material-system.ts`)
- Manages marble appearance (color, roughness, metallic)
- Creates instances for rendering variations

### Physics Simulation

**Rapier3D Setup**
- Gravity: -9.81 m/s²
- World created in `src/init/`
- Step rate: configurable (typically 60 FPS)
- Static bodies for floors, walls, platforms
- Dynamic bodies for marbles with properties:
  - Radius: 0.5 units (configurable per marble)
  - Friction: 0.3-0.7 (marble-dependent)
  - Restitution: 0.6-1.0 (bounciness)

**Collision Detection**
- Contact detection for collectibles, goal zones
- Physics callbacks for gameplay events (bounce sounds, collectible pickup)

### Custom C++ WASM Physics Module

A native-speed physics helper module lives in `wasm/` and is compiled with
Emscripten to WebAssembly.  The JS façade in `src/wasm-bridge.js` wraps it and
provides transparent pure-JS fallbacks so the game always runs, even before the
WASM binary is built.

**Key functions exposed via Embind:**

| Function | Description |
|---|---|
| `vec3Distance` / `vec3DistanceSq` | 3-D distance helpers |
| `vec3Dot` / `vec3Length` / `vec3Normalize` | Vector math |
| `applyVelocityDamping` | Frame-rate–independent damping + speed cap |
| `computeForceField` | Inverse-power-law attraction / repulsion |
| `computeSpringForce` | Hooke's-law spring with damping |
| `reflectVelocity` | Specular velocity reflection off a surface |
| `closestPointOnSegment` | Nearest point on a segment (grapple / rails) |

**Usage:**
```javascript
import { initMarblePhysicsWasm, getMarblePhysics, getPhysicsBackend } from './wasm-bridge.js';

// Initialize once (e.g. during game init) — loads WASM when built, else JS fallbacks
await initMarblePhysicsWasm();
console.log(getPhysicsBackend()); // 'wasm' | 'js-fallback'

// then anywhere in the game loop:
const force = getMarblePhysics().computeForceField(
    bh.x, bh.y, bh.z,       // field origin
    marble.x, marble.y, marble.z, // target
    20.0, 1.0, 0.5, 25.0    // strength, falloff, minDist, maxDist
);
body.applyImpulse(force, true);
```

**Building the WASM binary** (requires [Emscripten SDK](https://emscripten.org)):
```bash
npm run build:wasm
```
Output: `public/wasm/marble_physics.{js,wasm}`

## Development Patterns

### Adding a New Zone

1. Create `src/zones/[zone-name].js` with zone setup function
2. Export from `src/zones/index.js`
3. Import and call setup in the appropriate game level selection
4. Define zone geometry using physics factory methods:
   ```javascript
   this.createStaticBody(position, collider, material);
   this.createDynamicEntity(position, collider, material);
   ```

### Creating Game Logic

- **Game state**: Add to `MarblesGame` constructor
- **Physics events**: Trigger in `game-loop-sync-methods.js` (step callback)
- **Rendering updates**: Apply in `game-loop-render-methods.js`
- **Input handling**: Define in `input-methods.js`

### Important Interfaces

**Rigid Body Properties** (Rapier)
```javascript
{
  type: 'dynamic' | 'fixed' | 'kinematic',
  position: { x, y, z },
  rotation: { x, y, z, w }, // quaternion
  linearVelocity: { x, y, z },
  angularVelocity: { x, y, z }
}
```

**Entity Transform** (Filament)
```javascript
// 16-element column-major 4x4 matrix
[m00, m10, m20, m30, m01, m11, m21, m31, ...]
// Conversion via quaternionToMat4() helper
```

## Key Implementation Details

### Transform Conversion
Rapier uses quaternions for rotation; Filament uses 4x4 matrices. The `quaternionToMat4()` function (in `math.ts`) handles this conversion for each frame.

### Game Loop Structure
1. **Physics**: `world.step()` advances simulation
2. **Logic**: Check game state, collectibles, goals, abilities
3. **Sync**: Extract physics transforms, convert to matrices
4. **Render**: Update Filament entities, render frame
5. **Input**: Process keyboard/mouse for next frame

### HUD System
`HUDManager` class manages canvas overlay rendering for:
- Score/stats display
- Ability cooldown bars
- Goal/objective markers
- UI state (level select, game over)

### Ability System
Special abilities use internal cooldown tracking:
- Missiles: 1.5s cooldown, with visual bar
- Bombs: 5s cooldown
- Black Holes: 5s cooldown, with visual bar
- Holo Platforms: 3s duration, 5s cooldown

## Performance Considerations

- **WASM Overhead**: Minimize Rapier<->JS calls; batch updates per frame
- **Rendering**: Filament handles draw optimization; limit entity count in complex zones
- **Audio**: Web Audio API integration in `audio.js`; respect playback limits
- **Memory**: Physics bodies/entities should be cleaned up when zones change

## Testing

- Test files in `src/__tests__/`
- Use jsdom + Playwright for rendering/physics verification
- Check browser console for physics logs and rendering errors

## TypeScript Support

Project includes `tsconfig.json` for type checking. TSX components exist in `src/components/` for UI modals.

## Git & Contributing

- Branch naming: descriptive feature branches (e.g., `feature/new-zone-name`)
- Commit messages: concise, action-oriented
- Asset PRs: include manifest.json updates
- Code review: check for physics correctness, performance, asset validation

## Common Commands

```bash
# Development
npm run dev                    # Start dev server with hot reload
npm run build                  # Production build to dist/

# Review & Debug
# Check console in browser for physics logs and rendering status
# Inspect Elements to debug HUD/canvas rendering
# Use browser DevTools to profile rendering performance
```

## Known issues / blockers

- Three recently merged zones — Astral Cascade (`src/zones/astral-cascade.js`), Inferno Chamber (`src/zones/inferno-chamber.js`), and Aether Core (`src/zones/aether-core.js`) — are only registered as `DEV_LEVELS` entries in `src/levels.ts` (reachable via `?devLevels=1`), not added to the shipped 24-map `assets/manifest.json` that normal play uses. A fourth zone from the same run of feature PRs, Cyber Reactor (`cyber_run`), *did* make it into the live manifest. Unclear whether the other three are intentionally staged in dev-only limbo or just missed the manifest update — worth confirming before assuming they're live content.
- `docs/backups/` (including the `_backup_*` files and `orphan-react-stack/`) is intentionally archived and excluded from `tsconfig.json` — not dead weight to clean up, already correctly documented in AGENTS.md's "Non-obvious gotchas".
- `npm run lint` and `npm run typecheck` were re-verified clean as of this check (2026-09-26) — the doc's claim still holds. `typecheck` covers the composed systems (`src/game/systems/*.ts`), `wasm-bridge.js`, `src/webgpu/**`, and `src/gpu-chores/**`; JS is only checked where a file has `// @ts-check` (see `docs/architecture/language-strategy.md`).
- `backend/core/app_storage_manager.py` is the single copy of the legacy monolithic storage module (the byte-identical `backend/shared/hf/` duplicate was removed 2026-09-26; nothing imported either). The live API is `backend/storage/` (`uvicorn storage.main:app`).
- The WebGPU boot probe (`src/webgpu/boot-probe.js`, run from `InitCore.init()` before Filament loads) is **not** a hard requirement: on failure Filament still boots on WebGL2, `window.webgpuProbe.ok === false`, `window.rendererFallbackReason` is set, and particles/gpu-chores run on the CPU. The probe requests a descriptor sized to the particle + chores working set, matches the WebGL `powerPreference`, and allows one device recovery after a loss. `?renderer=simple` is a dev/e2e-only flag. See `docs/WEBGPU_BOOT_PROBE.md` and `docs/RENDERER_FALLBACK.md`.

## Resources

- **Filament Docs**: https://google.github.io/filament/
- **Rapier3D**: https://rapier.rs/
- **WebGPU Boot Probe**: See `docs/WEBGPU_BOOT_PROBE.md`
- **GPU Chores**: See `docs/GPU_CHORES.md`
- **Asset Contributing**: See `docs/CONTRIBUTING.md`
- **Game Design Analysis**: Historical snapshot — see `docs/GAME_ANALYSIS.md` (archived; 7-level era)

## Notes

- The game dynamically loads zones and marbles from asset definitions
- Audio system integrated via `audio.js` with spatial/collision-triggered sounds
- HUD overlays on canvas; separate from Filament rendering
- Physics and rendering stay in sync via transform synchronization each frame
- Zone-specific methods in `zones/methods/` provide utilities for collision detection and zone interactions
