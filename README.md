# Marbles 3D Game

A 3D marble roller game using Google Filament (WASM) and Rapier3D-Compat for physics simulation.

## Features

- **Physics Engine**: Rapier3D-Compat with gravity set to -9.81
- **3D Rendering**: Google Filament (WASM-based) for high-performance rendering
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
└── src/
    └── main.js         # Main game logic
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

## Implementation Details

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

## Browser Requirements

- WebGL2 support
- WASM support  
- Cross-Origin isolation for SharedArrayBuffer (COOP/COEP headers configured in Vite)

## Notes

- Filament uses a UMD/WASM loading pattern which may require additional configuration in some environments
- The physics simulation runs independently and can be tested even if Filament rendering is unavailable
- Console logs show marble positions updating as physics simulation runs

