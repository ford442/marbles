# Marble Visual Overhaul - Integration Guide

## Quick Start

### 1. Import the Module

```typescript
import { MarbleVisual, createMarbleVisual, getThemeForMarble } from './visuals/MarbleVisual';
```

### 2. Replace Material Creation

**Before:**
```typescript
const material = Filament.Material.Builder()
  .package(basicMaterialPackage)
  .build(engine)
  .getDefaultInstance();
```

**After:**
```typescript
const visual = createMarbleVisual(engine, scene, MarbleTheme.CLASSIC_GLASS, position);
```

### 3. Add to Game Loop

```typescript
// In your update loop
marbles.forEach(marble => {
  marble.visual.update(deltaTime, marble.velocity, marble.angularVelocity);
});
```

### 4. Hook Up Physics Events

```typescript
// In collision handler
marble.visual.onContact(collision.impulse);
```

### 5. Hook Up Input

```typescript
// On boost button press
marble.visual.onBoostStart();

// On boost button release
marble.visual.onBoostEnd();
```

### 6. Add LOD Updates

```typescript
// When camera moves
marbles.forEach(marble => {
  const distance = vec3.distance(camera.position, marble.position);
  marble.visual.setLOD(distance);
});
```

## Complete Integration Example

```typescript
import * as Filament from 'filament';
import { vec3, quat } from 'gl-matrix';
import { MarbleVisual, getThemeForMarble, MarbleTheme } from './visuals/MarbleVisual';

class Marble {
  visual: MarbleVisual;
  position: vec3 = vec3.create();
  velocity: vec3 = vec3.create();
  angularVelocity: vec3 = vec3.create();
  radius: number = 0.5;

  constructor(
    engine: Filament.Engine,
    scene: Filament.Scene,
    public id: string,
    startPosition: vec3
  ) {
    const theme = getThemeForMarble(id);
    this.visual = createMarbleVisual(engine, scene, theme, startPosition);
    vec3.copy(this.position, startPosition);
  }

  update(deltaTime: number): void {
    // Physics update (your existing code)
    this.updatePhysics(deltaTime);
    
    // Visual update
    this.visual.update(deltaTime, this.velocity, this.angularVelocity);
    this.visual.setTransform(this.position, this.getRotation());
  }

  onCollision(other: Marble, impulse: number): void {
    // Your collision response
    this.resolveCollision(other, impulse);
    
    // Visual effect
    this.visual.onContact(impulse);
  }

  startBoost(): void {
    this.boostActive = true;
    this.visual.onBoostStart();
  }

  endBoost(): void {
    this.boostActive = false;
    this.visual.onBoostEnd();
  }

  setLOD(distance: number): void {
    this.visual.setLOD(distance);
  }

  destroy(): void {
    this.visual.destroy();
  }

  private getRotation(): quat {
    // Convert your rotation matrix to quaternion
    return quat.create();
  }
}

// In your game class
class MarbleGame {
  private marbles: Marble[] = [];
  private engine: Filament.Engine;
  private scene: Filament.Scene;
  private camera: Filament.Camera;

  createMarble(id: string, position: vec3): void {
    const marble = new Marble(this.engine, this.scene, id, position);
    this.marbles.push(marble);
  }

  update(deltaTime: number): void {
    // Update all marbles
    this.marbles.forEach(marble => marble.update(deltaTime));
    
    // Update LOD based on camera
    this.updateLOD();
  }

  private updateLOD(): void {
    const camPos = this.camera.getPosition();
    this.marbles.forEach(marble => {
      const distance = vec3.distance(camPos, marble.position);
      marble.setLOD(distance);
    });
  }

  onCollision(marble1: Marble, marble2: Marble, impulse: number): void {
    marble1.onCollision(marble2, impulse);
    marble2.onCollision(marble1, impulse);
  }

  clearLevel(): void {
    this.marbles.forEach(m => m.destroy());
    this.marbles = [];
  }
}
```

## Theme Mapping

Map your existing marble IDs to themes:

```typescript
const themeMap: Record<string, MarbleTheme> = {
  // Glass marbles
  'classic_blue': MarbleTheme.CLASSIC_GLASS,
  'classic_green': MarbleTheme.CLASSIC_GLASS,
  
  // Metal marbles
  'classic_red': MarbleTheme.OBSIDIAN_METAL,
  'shadow_ninja': MarbleTheme.OBSIDIAN_METAL,
  'volcanic_magma': MarbleTheme.OBSIDIAN_METAL,
  
  // Neon marbles
  'cosmic_nebula': MarbleTheme.NEON_GLOW,
  
  // Stone marbles
  'earth_tones': MarbleTheme.STONE_VEIN,
  'granite': MarbleTheme.STONE_VEIN,
  
  // Default
  'default': MarbleTheme.CLASSIC_GLASS
};
```

## Performance Tuning

### Reduce Quality for Many Marbles

```typescript
// If more than 8 marbles, reduce to medium LOD
if (this.marbles.length > 8) {
  this.marbles.forEach(m => m.visual.setLOD(20)); // Force medium
}
```

### Disable Particles

```typescript
// In MarbleVisual constructor, add option:
constructor(engine, scene, config, options = {}) {
  this.enableParticles = options.enableParticles !== false;
  // ...
}
```

### Use Impostors for Distance

Already implemented - marbles beyond 60m use billboard impostors.

## Troubleshooting

### WebGL2 Not Supported

```typescript
import { checkWebGL2Support } from './visuals/MarbleVisual';

if (!checkWebGL2Support()) {
  console.warn('WebGL2 not supported, falling back to basic materials');
  // Use simplified material path
}
```

### Performance Issues

Check metrics:

```typescript
marbles.forEach(marble => {
  const metrics = marble.visual.getPerformanceMetrics();
  console.log(`Marble ${marble.id}: ${metrics.avgUpdateTime.toFixed(3)}ms avg`);
});
```

Target: < 0.5ms per marble

### Memory Usage

Each marble uses ~2.5MB:
- Textures: 2MB
- Geometry: 0.3MB
- Material: 0.2MB

For 16 marbles: ~40MB total

## Customization

### Create New Theme

```typescript
// Add to MarbleTheme enum
export enum MarbleTheme {
  // ... existing
  GOLD_LUXURY = 'gold_luxury'
}

// Add base material
const BASE_MATERIALS: Record<MarbleTheme, BaseMaterialProps> = {
  // ... existing
  [MarbleTheme.GOLD_LUXURY]: {
    color: vec4.fromValues(1.0, 0.84, 0.0, 1.0),
    roughness: 0.15,
    metallic: 1.0,
    // ...
  }
};

// Add material creation
private createGoldMaterial(builder, base) {
  // Custom gold shader
}
```

## API Reference

### MarbleVisual

| Method | Description |
|--------|-------------|
| `update(deltaTime, velocity, angularVelocity)` | Call every frame |
| `onContact(impactForce)` | Call on collision |
| `onBoostStart()` | Call when boost begins |
| `onBoostEnd()` | Call when boost ends |
| `setLOD(distance)` | Update based on camera distance |
| `setTransform(position, rotation)` | Update from physics |
| `destroy()` | Cleanup when marble removed |
| `getPerformanceMetrics()` | Get timing stats |

### Utility Functions

| Function | Description |
|----------|-------------|
| `createMarbleVisual(engine, scene, theme, position)` | Factory function |
| `getThemeForMarble(marbleId)` | Map ID to theme |
| `checkWebGL2Support()` | Check compatibility |
| `validatePerformance(metrics)` | Check if meeting target |

## Support

For issues or questions about the visual overhaul:
1. Check performance metrics first
2. Verify WebGL2 support
3. Review integration points
4. Check browser console for shader compile errors
