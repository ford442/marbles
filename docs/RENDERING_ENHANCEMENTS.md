# Rendering Enhancements for Marbles

This document describes the visual complexity enhancements added to improve the aesthetic beauty of the marbles and course rendering.

## 6. Image-Based Lighting (IBL) + Environment System

### Overview

The flat single-preset indirect-light / solid-colour skybox has been replaced with a
**themed environment system** that gives every level a unique, physically-plausible IBL
environment sourced from hand-tuned 3-band spherical harmonics (SH) coefficients.

The foundation is intentionally cubemap-ready: when `.ktx` cubemap assets are placed in
`assets/environments/`, the `buildEnvironmentLighting()` helper can be extended with
`.reflections(cubemapTexture)` on the `IndirectLight.Builder` call to upgrade from
diffuse-only SH to full specular IBL with view-dependent reflections.

### New Module: `src/rendering/environment.js`

| Export | Purpose |
|---|---|
| `ENVIRONMENT_PRESETS` | Object containing all 5 named environment configs |
| `ZONE_ENVIRONMENT_MAP` | Default zone-type → environment key mapping |
| `buildEnvironmentLighting(engine, scene, Filament, envName, quality)` | Creates and applies `IndirectLight` + `Skybox`, returns `{ ibl, skybox }` |
| `destroyEnvironmentLighting(engine, scene, ibl, skybox)` | Safely tears down previously created objects |

### Available Environments

| Key | Description | Use case |
|---|---|---|
| `default` | Warm blue-sky studio (original SH) | General day-time outdoor levels |
| `space_nebula` | Deep-space nebula, purple/blue | Night / space / starlight levels |
| `ice` | Arctic glacier, cold blue-white | Ice cave, glacial, frozen levels |
| `volcanic` | Active lava, amber/red/smoke | Volcano, lava-tube, reactor levels |
| `neon_city` | Cyberpunk cityscape, cyan/magenta | Neon, cyber, synthwave levels |

### Changes in `src/zone-setup-methods.js`

- Replaced the inline IBL SH block and `.color()` skybox with a call to
  `setupEnvironmentLighting('default')` at the end of `setupPostProcessing()`.
- Added **`setupEnvironmentLighting(envName)`** – destroys any existing IBL/Skybox
  and rebuilds from the named preset.  Falls back gracefully to a 1-band SH if the
  3-band build fails.
- Added **`applyEnvironment(envName)`** – lightweight wrapper that skips the rebuild
  if the requested environment is already active.  Safe to call before Filament is
  fully initialised.

Back-compat aliases `this.ibl` and `this.skyboxEntity` continue to point at the
active objects, so any code that reads those properties still works.

### Changes in `src/zones/methods/visuals.js`

- `setNightMode(true)` now also calls `applyEnvironment('space_nebula')` unless the
  level has already specified an explicit environment override.
- `setNightMode(false)` restores `applyEnvironment('default')`.
- New **`setEnvironment(envName)`** method – call *after* `setNightMode()` in
  `loadLevel()` to pin the IBL to a specific preset.  Sets an internal
  `_environmentOverridden` flag that prevents `setNightMode` from clobbering the
  explicit choice.

### Changes in `src/init/level-loader.js`

```javascript
// Apply per-level environment after nightMode to let it take precedence
if (level.environment) {
    this.setEnvironment(level.environment)
}
```

### Changes in `src/levels.js`

All themed levels now carry an explicit `environment` field:

| Level | Environment |
|---|---|
| `volcano_run`, `radiant_reactor_run` | `volcanic` |
| `ice_cave_run`, `glacial_chasm_run`, `frostbite_cavern_run`, `cyber_ice_track_run` | `ice` |
| `neon_dash`, `cyber_run`, `neon_alley_run`, `neon_pulse_grid_run`, `synthwave_surge_run`, `plasma_pipeline_run` | `neon_city` |
| `starlight_ascent_run`, `galaxy_spiral_run`, `nebula_nexus_run`, `quantum_tunnel_run` | `space_nebula` |

Levels with `nightMode: true` but no explicit `environment` automatically use
`space_nebula` via the `setNightMode` heuristic.

### Changes in `src/material-presets.js`

Added `zoneEnvironmentMapping` export – maps zone-type strings to environment keys.
This is the single authoritative lookup table for zone-level environment assignments,
complementing the level-level `environment` field in `levels.js`.

### Acceptance Criteria (from issue)

- [x] On load, the scene uses a themed `IndirectLight` preset with per-level SH coefficients.
- [x] At least 3 distinct themed environments (`space_nebula`, `ice`, `volcanic`) selectable by level.
- [x] `neon_city` and `default` bring the total to 5 distinct environments.
- [x] Existing `nightMode` / `setNightMode` paths continue to work.
- [x] `environment` field in level config overrides the nightMode default.
- [x] Performance: no regression on medium preset; low falls back to 1-band SH automatically.
- [x] Documentation updated in `docs/RENDERING_ENHANCEMENTS.md`.

### Future: KTX Cubemap Reflections (Phase 2) — ✅ Implemented

Specular IBL via KTX1 cubemaps is now live for **high** and **ultra** quality.

#### How it works

1. `buildEnvironmentLighting()` (sync) builds the SH-only IBL as before — no
   change for low/medium.
2. For high/ultra, `setupEnvironmentLighting()` immediately fires an async
   upgrade via `_upgradeEnvironmentWithCubemap(envName)`.
3. The async path fetches `assets/environments/{envName}.ibl.ktx` and
   `assets/environments/{envName}.skybox.ktx` in parallel.
4. On success, the old SH-only IBL is destroyed and replaced with:
   ```javascript
   IndirectLight.Builder()
       .reflections(iblTexture)    // specular IBL – view-dependent
       .irradianceSh(3, preset.sh) // diffuse IBL  – same hand-tuned SH
       .intensity(preset.iblIntensity)
       .build(engine)
   ```
5. The skybox is rebuilt with `Skybox.Builder().environment(skyboxTexture)`.
6. If the KTX file is absent or fails to load, the SH-only environment remains
   active with no error surfaced to the user (console.log only).

#### Shipped assets

Five synthetic KTX1 cubemaps (one per preset) are shipped under
`assets/environments/`.  They are generated from the same SH coefficients used
for diffuse GI by running:

```sh
node scripts/generate-env-cubemaps.js
```

Replace them with `cmgen`-generated HDR cubemaps for photorealistic
reflections.  See `assets/environments/README.md` for format details and
replacement instructions.

#### Material parameters wired

`applyFullPreset()` in `src/material-system.js` now applies these optional
parameters from every material preset that defines them:

| Parameter             | Where defined                                       |
|-----------------------|-----------------------------------------------------|
| `clearCoatIor`        | `src/material-presets.js`, `src/rendering/material-variants.js` |
| `environmentIntensity`| Same                                                |
| `reflectionStrength`  | Same                                                |

Each is applied with `try/catch` so older material shader versions that do not
expose the uniform are handled gracefully.

#### Acceptance criteria

- [x] At least one environment (`neon_city`, `ice`, etc.) ships with a real cubemap reflection.
- [x] Glossy marbles and floors show view-dependent specular highlights from the environment.
- [x] No regression on low/medium quality presets (SH-only path unchanged).
- [x] Documentation updated in `RENDERING_ENHANCEMENTS.md`.

---

## 1. Enhanced Shadow System

Shadow quality is now gated behind the graphics quality preset via `getShadowQualityConfig(quality)` in `src/rendering-defaults.js`. Settings are applied in both `setupPostProcessing()` (initial load) and `applyGraphicsSettings()` (live changes from the settings panel).

### Quality Tiers

| Preset | Map Size | Cascades | VSM | Soft Shadows | Contact Shadows |
|--------|----------|----------|-----|--------------|-----------------|
| `low` | 512 | 1 | No | No | No |
| `medium` | 1024 | 1 | No | No | No |
| `high` | 2048 | 2 | Yes (standard) | No | Yes |
| `ultra` | 4096 | 2 | Yes (high precision) | Yes (PCSS) | Yes |

### Changes in `src/rendering-defaults.js`

New export `getShadowQualityConfig(quality)` returns:
- `shadowOptions` – passed to `view.setShadowOptions()`
- `vsmOptions` – passed to `view.setVsmShadowOptions()` when non-null (high/ultra only)
- `softOptions` – passed to `view.setSoftShadowOptions()` when non-null (ultra only)

#### VSM (Variance Shadow Mapping) — high/ultra
```javascript
// high preset
this.view.setVsmShadowOptions({
    anisotropy: 1,
    mipmapping: true,
    msaaSamples: 2,
    highPrecision: false,
    minVarianceScale: 0.5,
    lightBleedReduction: 0.2,
})

// ultra preset adds highPrecision: true, msaaSamples: 4
```

#### Soft Shadow Penumbra — ultra only
```javascript
// PCSS-like soft shadows
this.view.setSoftShadowOptions({
    penumbraScale: 2.0,
    penumbraRatioScale: 0.5,
})
```

### Changes in `src/zone-setup-methods.js`

`setupPostProcessing()` now calls `getShadowQualityConfig(quality)` and applies all three shadow option objects in guarded try/catch blocks.

### Changes in `src/init/settings.js`

`applyGraphicsSettings()` applies the same shadow configuration whenever quality or shadow toggle changes, enabling instant reflection without restart.

## 2. Enhanced Material System

### New Material Definition: `custom_material_procedural.mat`

A new PBR material with procedural bump mapping support:

```
Features:
- Procedural surface detail using Simplex noise
- PBR parameters: baseColor, roughness, metallic, reflectance
- Clear coat support for glossy surfaces
- Configurable bump scale and frequency
- Specular anti-aliasing for smooth highlights
```

#### Material Parameters:
- `baseColor` (float3): Surface color
- `roughness` (float): Surface roughness (0 = mirror, 1 = diffuse)
- `metallic` (float): Metallic factor (0 = dielectric, 1 = metal)
- `bumpScale` (float): Height of surface bump detail
- `bumpFrequency` (float): Density of bump pattern
- `reflectance` (float): Specular reflectance
- `clearCoat` (float): Clear coat layer intensity
- `clearCoatRoughness` (float): Clear coat roughness

### Procedural Bump Mapping

The material uses Simplex noise in the fragment shader to procedurally generate surface normals:

```glsl
// Calculate procedural normal perturbation
float noise = snoise(uv * frequency);
float noiseX = snoise((uv + vec2(0.01, 0.0)) * frequency);
float noiseY = snoise((uv + vec2(0.0, 0.01)) * frequency);

vec3 normalTangent;
normalTangent.x = (noiseX - noise) * scale * 100.0;
normalTangent.y = (noiseY - noise) * scale * 100.0;
normalTangent.z = 1.0;
material.normal = normalize(normalTangent);
```

## 3. Material System Helper: `src/material-system.js`

A comprehensive material management module with:

### Procedural Texture Generation
Canvas-based texture generators for:
- `noise_normal`: Random normal map
- `bump_rough`: Rough surface height map
- `marble_pattern`: Marble vein pattern
- `roughness`: Roughness variation map
- `ao`: Ambient occlusion approximation

### Material Presets

```javascript
materialPresets = {
    polishedMarble: { roughness: 0.05, metallic: 0.0, reflectance: 0.8, ... },
    roughConcrete: { roughness: 0.9, metallic: 0.0, reflectance: 0.2, ... },
    shinyMetal: { roughness: 0.2, metallic: 1.0, reflectance: 1.0, ... },
    woodenFloor: { roughness: 0.6, metallic: 0.0, reflectance: 0.3, ... },
    glass: { roughness: 0.0, metallic: 0.0, reflectance: 1.0, ... }
}
```

### Enhanced Material Creation

```javascript
createEnhancedMaterialInstance(material, Filament, type, baseColor)
```

Creates material instances with preset PBR properties.

## 4. Integration with Marble System

### Changes in `src/marble-management-methods.js`

Updated `createMarbles()` to support enhanced material properties:

```javascript
// Apply PBR material properties with enhanced defaults
const preset = info.materialType ? materialPresets[info.materialType] : null
const roughness = info.roughness !== undefined ? info.roughness : (preset ? preset.roughness : 0.4)
const metallic = info.metallic !== undefined ? info.metallic : (preset ? preset.metallic : 0.0)
const reflectance = info.reflectance !== undefined ? info.reflectance : (preset ? preset.reflectance : 0.5)
const clearCoat = info.clearCoat !== undefined ? info.clearCoat : (preset ? preset.clearCoat : 0.0)
```

## 5. Dynamic / Themed Zone Lights

### `createZoneLight()` factory — `src/zones/methods/visuals.js`

A reusable helper that creates a coloured `POINT` or `SPOT` Filament light and registers
it as a static scene entity:

```javascript
import { createZoneLight } from './methods/visuals.js';

createZoneLight(game, 'POINT', pos, color, intensity, falloff);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `game` | object | Game instance (engine, scene, Filament, staticEntities) |
| `type` | `'POINT'`\|`'SPOT'` | Filament light type |
| `pos` | `{x,y,z}` | World-space position |
| `color` | `[r,g,b]` | Linear RGB colour |
| `intensity` | number | Luminous intensity (lm) |
| `falloff` | number | Light radius / falloff distance |

### Zones with Themed Dynamic Lights

| Zone | Lights Added | Theme |
|------|-------------|-------|
| `lava-tubes.js` | 3 × POINT | Deep orange-red lava glow beneath tubes |
| `ice-bridges.js` | 2 × POINT | Cold pale-blue arctic ambiance |
| `neon-grid.js` | 3 × POINT | Magenta / cyan / green neon underlighting |
| `crystal-cavern.js` | 3 × POINT | Violet, cyan, and pink crystal caustics |

## 6. Future Enhancements

### Immediate Next Steps:
1. **KTX Cubemap Reflections**: Load `.ktx2` cubemaps into `buildEnvironmentLighting()` for specular IBL
2. **Subsurface Scattering**: For translucent marble materials
3. **Dynamic Environment Probes**: Real-time reflection captures for key glossy zones
4. **Animated Lights**: Hook `createZoneLight` entities into the game-loop update for flickering/pulsing lava, neon strobes, and crystal shimmer effects

### Advanced Features:
1. **Volumetric Effects**: Light shafts, god rays in the course
2. **Screen Space Reflections (SSR)**: Already enabled on high/ultra quality — pairs with IBL

## Usage

To use the enhanced shadows, no code changes are required - they're automatically applied via `setupPostProcessing()`.

To assign an environment to a level, add the `environment` field to its entry in `levels.js`:

```javascript
my_level: {
    name: 'My Level',
    zones: [...],
    spawn: { x: 0, y: 5, z: -5 },
    goals: [...],
    nightMode: true,
    backgroundColor: [0.05, 0.0, 0.0, 1.0],
    environment: 'volcanic'   // 'default' | 'space_nebula' | 'ice' | 'volcanic' | 'neon_city'
}
```

To switch environment from within a zone or game-logic method:

```javascript
this.applyEnvironment('ice')        // ZoneSetupMethods method
this.setEnvironment('ice')          // visualMethods alias (prevents nightMode from overriding)
```

## Technical Notes

### Shader Compilation
The enhanced material (`custom_material_procedural.mat`) needs to be compiled with Filament's `matc` tool:

```bash
matc -p web -o baked_enhanced.filmat custom_material_procedural.mat
```

### Performance Considerations
- SH 3-band IBL: Negligible GPU cost (evaluated per-pixel as a dot-product)
- Skybox colour pass: Effectively free
- Shadow map 2048x2048 with 2 cascades: Moderate GPU cost
- VSM with mipmapping: Higher quality but more memory
- Procedural bump in shader: Very low cost (just noise math)

### Browser Compatibility
All enhancements use standard WebGL2 features. Requires:
- WebGL2 support
- Floating point textures
- Multiple render targets (for shadows)

