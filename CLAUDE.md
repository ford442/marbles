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

Methods are organized into separate mixins applied via `apply*Methods` functions:

### Game Systems (Mixins)

**Physics & Rendering**
- `physics-factory-methods.js` - Creates rigid bodies, colliders, and entities
- `game-loop-sync-methods.js` - Synchronizes physics state with Filament entities
- `game-loop-render-methods.js` - Filament rendering pipeline

**Game Logic**
- `game-logic-methods.js` - Core gameplay systems (win conditions, checkpoints, collectibles)
- `game-loop-methods.js` - Main game loop orchestration
- `ability-methods.js` - Special abilities (bombs, missiles, black holes, holo platforms)

**Input & UI**
- `input-methods.js` - Marble movement and camera control
- `hud-manager.js` - HUD rendering and state display
- `marble-management-methods.js` - Marble spawning and lifecycle

**Zones & Initialization**
- `zone-setup-methods.js` - Zone loading and setup
- `zones/` - Individual zone implementations (50+ levels)
- `zones/methods/` - Zone utility functions
- `init-methods.js` - Filament engine initialization and asset loading

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
- Loaded via UMD pattern in `init-methods.js`
- Requires COOP/COEP headers for SharedArrayBuffer (configured in vite.config.js)
- Assets (GLTF, materials) loaded through Filament's asset pipeline
- Transform matrices sync physics positions to render entities

**Materials System** (`material-system.js`)
- Manages marble appearance (color, roughness, metallic)
- Creates instances for rendering variations

### Physics Simulation

**Rapier3D Setup**
- Gravity: -9.81 m/s²
- World created in `init-methods.js`
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
Rapier uses quaternions for rotation; Filament uses 4x4 matrices. The `quaternionToMat4()` function (in game-loop-sync-methods.js) handles this conversion for each frame.

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

## Resources

- **Filament Docs**: https://google.github.io/filament/
- **Rapier3D**: https://rapier.rs/
- **Asset Contributing**: See `docs/CONTRIBUTING.md`
- **Game Design Analysis**: Historical snapshot — see `docs/GAME_ANALYSIS.md` (archived; 7-level era)

## Notes

- The game dynamically loads zones and marbles from asset definitions
- Audio system integrated via `audio.js` with spatial/collision-triggered sounds
- HUD overlays on canvas; separate from Filament rendering
- Physics and rendering stay in sync via transform synchronization each frame
- Zone-specific methods in `zones/methods/` provide utilities for collision detection and zone interactions
