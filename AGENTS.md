# Marbles 3D Game - Agent Guide

This document provides essential information for AI coding agents working on the Marbles 3D project.

## Project Overview

**Marbles** is a browser-based 3D marble roller game that combines:
- **Physics Simulation**: Rapier3D-Compat for realistic physics (gravity: -9.81 m/s²)
- **3D Rendering**: Google Filament (WASM) for high-performance WebGL2 rendering
- **Build System**: Vite for development and production builds

The game features multiple levels with obstacles, scoring zones, and different marble types with unique physics properties.

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Build Tool | Vite | ^7.3.1 |
| 3D Engine | Filament (Google) | ^1.51.5 |
| Physics Engine | Rapier3D-Compat | ^0.13.0 |
| Language | JavaScript (ES Modules) | - |
| Deployment | Python + Paramiko (SFTP) | - |

## Project Structure

```
marbles/
├── index.html              # Main HTML entry point with UI overlay
├── package.json            # Dependencies and npm scripts
├── vite.config.js          # Vite configuration with COOP/COEP headers
├── deploy.py               # Python deployment script (SFTP to remote server)
├── git.sh                  # Simple git commit/push helper
├── public/                 # Static assets
│   ├── baked_color.filmat  # Pre-compiled Filament material
│   ├── custom_material.mat # Source material definition
│   └── filament.wasm       # Filament WASM binary
└── src/
    ├── main.js             # Main game logic (~770 lines)
    └── sphere.js           # Sphere geometry generator with TBN frames
```

## Build Commands

```bash
# Development server (serves on localhost with hot reload)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

## Code Organization

### Main Game Class (`src/main.js`)

The `MarblesGame` class is the core of the application:

**Initialization Flow:**
1. `init()` - Sets up input listeners, initializes physics world
2. `loadFilament()` - Dynamically imports Filament WASM module
3. `setupAssets()` - Loads baked material and creates vertex/index buffers
4. `createLight()` - Sets up directional sun, fill, and back lights
5. `create*Zone()` methods - Build the level geometry (floor, track, obstacles)
6. `createMarbles()` - Spawns marbles with different physics properties

**Key Methods:**
- `createStaticBox(pos, rotation, halfExtents, color)` - Creates static physics body + visual cube
- `createMarbles()` - Spawns dynamic spheres with configurable radius, friction, restitution, density
- `loop()` - Main game loop: input handling → physics step → transform sync → render
- `checkGameLogic()` - Respawn logic and scoring detection

### Sphere Geometry (`src/sphere.js`)

- `createSphere(radius, widthSegments, heightSegments)` - Generates UV sphere with TBN frame quaternions
- `tbnToQuaternion(t, b, n)` - Converts tangent/bitangent/normal to quaternion
- Returns `{ vertices: Float32Array, indices: Uint16Array }`

### Math Helper

- `quaternionToMat4(position, quaternion)` - Converts Rapier physics transform to column-major 4x4 matrix for Filament

## Level Structure

The game consists of multiple connected zones:

1. **Starting Platform** (Z: -12) - Marble spawn points
2. **Ramp** (Z: 0 to 15) - Angled ramp with side walls
3. **Landing Zone** (Z: 15-35) - Flat area with pillars
4. **Goal 1** (Z: 32.5) - Gold platform, first scoring zone
5. **Jump Zone** (Z: 35-65) - Ramp up, gap, landing platform
6. **Slalom Zone** (Z: 65-105) - Oscillating pillars, Goal 2 at end
7. **Staircase Zone** (Z: 110-156) - 10 steps ascending to Goal 3

## Marble Types

| Type | Color | Radius | Properties |
|------|-------|--------|------------|
| Standard Red | [1,0,0] | 0.5 | Default |
| Standard Blue | [0,0,1] | 0.5 | Default |
| Speedster | [0.2,1,0.2] | 0.4 | friction: 0.1, restitution: 0.8 |
| Bouncy Giant | [0.6,0.1,0.8] | 0.75 | restitution: 1.2 |
| Golden Heavy | [1,0.84,0] | 0.6 | density: 3.0, restitution: 0.2 |
| Ice | [0,0.8,1] | 0.5 | friction: 0.05, roughness: 0.1 |

## Input Controls

| Key | Action (Orbit Mode) | Action (Follow Mode) |
|-----|---------------------|----------------------|
| W / Arrow Up | Zoom in | Move forward (+Z impulse) |
| S / Arrow Down | Zoom out | Move backward (-Z impulse) |
| A / Arrow Left | Rotate camera left | Move left (-X impulse) |
| D / Arrow Right | Rotate camera right | Move right (+X impulse) |
| Space | - | Jump (+Y impulse) |
| R | Reset all marbles | Reset all marbles |
| C | Toggle camera mode | Toggle camera mode |

## Camera Modes

- **Orbit Mode** (`cameraMode = 'orbit'`): Camera rotates around origin at fixed radius
- **Follow Mode** (`cameraMode = 'follow'`): Camera tracks player marble from behind

## Development Conventions

### Code Style
- ES Modules with `.js` extension in imports
- Class-based architecture with clear separation of concerns
- Physics body and visual entity created together, stored in arrays
- Use `this.Filament.*` and `RAPIER.*` namespaces explicitly

### Naming Conventions
- Private methods/properties: standard naming (no `_` prefix)
- Physics-related: `rigidBody`, `world`, `collider`
- Visual-related: `entity`, `material`, `mesh`
- Combined objects stored in arrays like `this.marbles`

### Transform System
Filament uses column-major matrices. The `quaternionToMat4()` helper handles conversion from Rapier's quaternion + position format. Scale is applied by multiplying the upper 3x3 matrix columns.

## Testing Strategy

There are no automated tests. Testing is manual:

1. Run `npm run dev` and open browser
2. Verify marbles fall and collide with level geometry
3. Test all camera modes and controls
4. Check that scoring works in all three goal zones
5. Verify respawn when marbles fall below Y=-20

### Browser Requirements
- WebGL2 support
- WASM support
- SharedArrayBuffer (requires COOP/COEP headers - configured in Vite)

## Deployment Process

The `deploy.py` script handles deployment:

```bash
# 1. Build first
npm run build

# 2. Deploy (requires paramiko: pip install paramiko)
python deploy.py
```

**Configuration in deploy.py:**
- Host: `1ink.us`
- User: `ford442`
- Local source: `dist/`
- Remote target: `test.1ink.us/marbles`

The script uses SFTP to recursively upload the `dist/` directory.

## Important Configuration

### Vite Configuration (`vite.config.js`)

Critical for SharedArrayBuffer support:
```javascript
server: {
  headers: {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
}
```

Dependencies excluded from optimization (WASM modules):
- `filament`
- `@dimforge/rapier3d-compat`

WASM files handled as static assets:
```javascript
assetsInclude: ['**/*.wasm']
```

### Material System

The game uses a custom Filament material (`custom_material.mat`):
- Parameters: `baseColor` (float3), `roughness` (float)
- Shading model: lit, opaque
- Pre-compiled to `baked_color.filmat` for runtime

## Common Issues

1. **Filament WASM loading**: The module uses a UMD pattern with dynamic import. The loading code captures the module via `loadClassExtensions` hook.

2. **SharedArrayBuffer errors**: Ensure Vite dev server headers are configured correctly (COOP/COEP).

3. **Physics-Visual sync**: Always use `quaternionToMat4()` for transform conversion. Remember to apply scale separately.

4. **Marble scaling**: Physics radius and visual scale are separate. The `scale` property in marble objects is `radius / 0.5`.

## File Modification Guidelines

- **Adding new level zones**: Create a `create*Zone()` method following existing patterns, call from `init()`
- **Adding marble types**: Extend `marblesInfo` array in `createMarbles()`
- **Modifying physics**: Use Rapier APIs via `RAPIER.*` namespace after `RAPIER.init()`
- **Modifying rendering**: Use Filament APIs via `this.Filament.*` after initialization
- **Material changes**: Edit `custom_material.mat`, recompile with Filament `matc` tool to `baked_color.filmat`
