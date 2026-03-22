# Marble Visual Overhaul - Rendering Layer Integration Guide

## Agent 3 Deliverable Summary

This document describes the custom Filament shaders, particle effects, and post-processing systems created for the Marble Visual Overhaul project.

---

## 📁 File Structure

```
marble_rendering_layer.ts      # Core shader code & material configs
marble_materials.filamat       # Filament .mat file definitions
marble_rendering_manager.ts    # Runtime rendering manager
MARBLE_RENDERING_GUIDE.md      # This documentation
```

---

## 🎨 Custom Fragment Shaders

### 1. Classic Glass Marble
**File**: `marble_rendering_layer.ts` - `CLASSIC_GLASS_FRAGMENT_SHADER`

| Feature | Implementation |
|---------|---------------|
| Refraction | Ray-traced refraction with IOR 1.52 |
| Fresnel | Schlick approximation for edge highlights |
| Caustics | Layered sine-wave interference pattern |
| Dispersion | RGB offset sampling for chromatic aberration |

```typescript
// Key uniforms
uRefractionIndex: 1.52    // Glass index of refraction
uFresnelPower: 2.0        // Edge falloff sharpness
uCausticIntensity: 0.4    // Internal light pattern strength
```

### 2. Obsidian Metal Marble
**File**: `marble_rendering_layer.ts` - `OBSIDIAN_METAL_FRAGMENT_SHADER`

| Feature | Implementation |
|---------|---------------|
| Anisotropic | Ward BRDF with tangent/bitangent roughness |
| Metal Grain | Procedural sine-wave grain pattern |
| Scratches | Position-based directional micro-scratches |
| Heat Shimmer | Time-varying edge emission (volcanic origin) |

```typescript
// Key uniforms
uAnisotropy: 1.5          // Highlight elongation
uGrainScale: 8.0          // Metal grain frequency
uScratchesIntensity: 0.3  // Volcanic scratch visibility
```

### 3. Neon Glow Marble
**File**: `marble_rendering_layer.ts` - `NEON_GLOW_FRAGMENT_SHADER`

| Feature | Implementation |
|---------|---------------|
| Iridescence | Thin-film interference (soap bubble effect) |
| Holographic | Hexagonal grid + rainbow diffraction |
| Glitch | Temporal UV distortion effect |
| Bloom | Separate emissive output for bloom pass |

```typescript
// Key uniforms
uIridescenceScale: 0.6    // Rainbow effect intensity
uGlowIntensity: 2.0       // Core glow brightness
uHologramSpeed: 1.0       // Pattern animation speed
```

### 4. Stone Vein Marble
**File**: `marble_rendering_layer.ts` - `STONE_VEIN_FRAGMENT_SHADER`

| Feature | Implementation |
|---------|---------------|
| Subsurface | Wrap lighting + translucency approximation |
| Veins | Procedural layered sine pattern |
| Sparkles | View-dependent glint with temporal twinkling |
| Ambient Occlusion | Vein crevice darkening |

```typescript
// Key uniforms
uSSSIntensity: 0.3        // Subsurface light penetration
uSparkleDensity: 1.0      // Mineral glint frequency
uSparkleSpeed: 3.0        // Twinkle animation speed
```

---

## ✨ Particle Effects

### Speed Sparkles (Glass/Obsidian/Stone)
```typescript
trigger: 'speed'
triggerThreshold: 5.0
emission: Trailing particles when speed > 5 units/sec
color: Warm yellow → orange fade
```

### Impact Burst (All marbles)
```typescript
trigger: 'impact'
triggerThreshold: 3.0
emission: Radial burst on collision
count: Scales with impact force
color: White → amber fade
```

### Boost Flame (Neon only)
```typescript
trigger: 'boost'
emission: Continuous jet from rear
color: Cyan → blue plasma
direction: Opposite to velocity
```

### Neon Trail (Neon only)
```typescript
trigger: 'continuous'
emission: Constant trail emission
color: Cyan → purple fade
effect: Cyberpunk energy trail
```

---

## 🎬 Post-Processing Configurations

### Glass Post-Process
| Effect | Setting |
|--------|---------|
| Bloom | Intensity 0.3, Threshold 0.8 |
| Motion Blur | Intensity 0.3, 8 samples |
| SSR | Enabled, 64 steps |
| Color | Slight blue tint |

### Obsidian Post-Process
| Effect | Setting |
|--------|---------|
| Bloom | Intensity 0.4, Threshold 0.6 |
| Motion Blur | Intensity 0.5, 12 samples |
| SSR | Enabled, 80 steps (sharp reflections) |
| Color | Desaturated, high contrast |

### Neon Post-Process
| Effect | Setting |
|--------|---------|
| Bloom | Intensity 2.0, 6 iterations |
| Motion Blur | Intensity 0.4, 10 samples |
| Chromatic Aberration | 2% RGB split on boost |
| SSR | Enabled with color shift |
| Color | Saturated, high contrast |

### Stone Post-Process
| Effect | Setting |
|--------|---------|
| Bloom | Intensity 0.2 (subtle) |
| Motion Blur | Intensity 0.2, 6 samples |
| SSR | Disabled (diffuse surface) |
| Color | Warm tint, natural contrast |

---

## 🔮 Environment & Reflections

### Reflection Probe Setup
```typescript
resolution: 256              // Cubemap resolution
updateMode: 'realtime'       // Dynamic updates
position: [0, 5, 0]         // Probe placement
near: 0.1, far: 100.0       // Clipping planes
cullingMask: ['marbles', 'environment']
```

### IBL (Image-Based Lighting)
```typescript
iblIntensity: 1.0
iblRotation: 0.0
skyboxTexture: 'env_sky_cloudy.hdr'
```

### Quality Profiles
The renderer now supports quality profiles that scale reflection and post-process cost while preserving behavior.

```typescript
qualityProfile: 'balanced' | 'high' | 'cinematic'

// Example effects:
// - max reflection probe updates per frame
// - probe resolution scaling
// - SSR step scaling
// - bloom iteration cap
// - shadow map defaults
```

### Track Surface Visual Metadata (Optional)
Track zone entries can include an optional `surface` object and optional `reflection_probe_hint`.

```json
{
  "type": "flat",
  "props": { "zone": 6, "name": "Spiral Exit" },
  "surface": {
    "surfaceType": "obsidian",
    "roughnessOverride": 0.3,
    "metallicOverride": 0.55,
    "reflectionIntensity": 1.15,
    "shadowIntensity": 0.9,
    "shadowSoftness": 0.4
  },
  "reflection_probe_hint": "start_grid"
}
```

These fields are additive and optional. Existing tracks render with default values if omitted.

---

## 📐 LOD & Optimization

### LOD Levels
| Level | Distance | Mesh | Shadows |
|-------|----------|------|---------|
| 0 | 0m | High-poly (LOD0) | Cast + Receive |
| 1 | 10m | Medium (LOD1) | Cast + Receive |
| 2 | 30m | Low (LOD2) | Receive only |

### Impostor System
```typescript
distance: 60m                // Switch to billboard
textureResolution: 128      // Sprite size
updateRate: 10Hz            // Refresh frequency
billboardMode: 'spherical'  // Always face camera
```

### Instancing
```typescript
maxInstances: 100
frustumCulling: true
occlusionCulling: true
dynamicBatching: true
```

---

## 🚀 Usage Example

### Basic Setup
```typescript
import { 
  createRenderingManager,
  loadMarblePackage,
  resolveEnvironmentConfig
} from './marble_rendering_manager';

import trackData from './marble_track_level5_extreme.json';
import trackLighting from './marble_track_level5_extreme_lighting.json';

// Initialize Filament
const engine = Filament.Engine.create(canvas);
const scene = engine.createScene();
const view = engine.createView();
const camera = engine.createCamera();

// Create rendering manager
const renderer = createRenderingManager(engine, scene, view, camera, {
  trackData,
  environmentConfig: resolveEnvironmentConfig(trackLighting)
});

// Create marbles
const glassMarble = renderer.createMarble(
  'marble_01', 
  'ClassicGlass',
  { position: {x:0, y:2, z:0}, rotation: {x:0, y:0, z:0}, scale: {x:1, y:1, z:1} }
);

const neonMarble = renderer.createMarble(
  'marble_02',
  'NeonGlow', 
  { position: {x:2, y:2, z:0}, rotation: {x:0, y:0, z:0}, scale: {x:1, y:1, z:1} }
);
```

### Game Loop Integration
```typescript
function gameLoop(time: number) {
  const deltaTime = time - lastTime;
  
  // Update physics
  physicsWorld.step(deltaTime);
  
  // Update marble transforms from physics
  for (const body of physicsBodies) {
    renderer.updateMarble(
      body.id,
      body.transform,
      body.velocity,
      body.angularVelocity,
      body.isBoosting
    );
  }
  
  // Update rendering
  renderer.update(deltaTime, time);
  
  // Render
  renderer.render();
  
  requestAnimationFrame(gameLoop);
}
```

### Impact Event
```typescript
// Called from physics collision callback
function onCollision(marbleId: string, impactForce: number, contactPoint: Vector3) {
  renderer.triggerImpactBurst(marbleId, impactForce, contactPoint);
}
```

---

## 🔧 Compilation (Filament Materials)

### Using matc (Material Compiler)
```bash
# Compile each material definition
matc -o materials/marble_glass.filamat marble_materials/mat_glass.mat
matc -o materials/marble_obsidian.filamat marble_materials/mat_obsidian.mat
matc -o materials/marble_neon.filamat marble_materials/mat_neon.mat
matc -o materials/marble_stone.filamat marble_materials/mat_stone.mat

# Compile post-process materials
matc -o materials/pp_bloom.filamat marble_materials/pp_bloom.mat
matc -o materials/pp_motion_blur.filamat marble_materials/pp_motion_blur.mat
matc -o materials/pp_chromatic.filamat marble_materials/pp_chromatic.mat
matc -o materials/pp_ssr.filamat marble_materials/pp_ssr.mat
```

### Platform Targets
```bash
# Desktop (OpenGL/Vulkan)
matc -p desktop -o output.filamat input.mat

# Mobile (OpenGL ES)
matc -p mobile -o output.filamat input.mat

# Web (WebGL 2.0)
matc -p web -o output.filamat input.mat
```

---

## 📊 Performance Budgets

### Per Marble
| Component | Target Cost |
|-----------|-------------|
| Material (full) | 0.2ms |
| Material (LOD1) | 0.1ms |
| Material (LOD2) | 0.05ms |
| Impostor | 0.01ms |
| Particles (active) | 0.1ms / 100 particles |

### Post-Process
| Effect | Target Cost |
|--------|-------------|
| Bloom (4 iter) | 0.5ms |
| Motion Blur | 0.3ms |
| SSR | 1.0ms |
| Chromatic Aberration | 0.05ms |

### Total Frame Budget (60fps = 16.6ms)
- Rendering: ~8ms
- Physics: ~4ms
- Game Logic: ~2ms
- Buffer: ~2.6ms

---

## 🔗 Integration with Other Agents

### From Agent 1 (Geometry):
- Uses: `marble_lod0_highpoly.glb`, `marble_lod1_medium.glb`, `marble_lod2_low.glb`

### From Agent 2 (Materials):
- Inputs: Base textures, bump maps, procedural patterns
- Applies: Custom shaders enhance base materials

### To Agent 4 (Physics Integration):
- Provides: Particle spawn points, velocity data for motion blur
- Receives: Impact events for particle bursts

---

## 🐛 Troubleshooting

### Shader Compilation Errors
```
Error: Unknown type 'samplerCubemap'
Fix: Use 'samplerCube' instead (GLSL standard)
```

### Reflection Issues
```
Problem: Black reflections
Solution: Ensure envMap uniform is set and texture is loaded
```

### Performance Problems
```
Problem: Low FPS with many marbles
Solution: Enable instancing, reduce particle count, use LOD2 sooner
```

### Transparency Artifacts
```
Problem: Glass marble shows sorting issues
Solution: Enable OIT (Order-Independent Transparency) or sort draw calls
```

---

## 📚 References

- [Filament Documentation](https://google.github.io/filament/)
- [Filament Materials Guide](https://google.github.io/filament/Materials.html)
- [PBR Theory](https://google.github.io/filament/Filament.html)
- [WebGL 2.0 Spec](https://www.khronos.org/registry/webgl/specs/latest/2.0/)

---

**Agent 3 Complete** - Advanced Rendering Layer ready for integration with Agents 1-2 (Assets) and Agent 4 (Physics)
