# Rendering Enhancements for Marbles

This document describes the visual complexity enhancements added to improve the aesthetic beauty of the marbles and course rendering.

## 1. Enhanced Shadow System

### Changes in `src/zone-setup-methods.js`

#### Improved Shadow Mapping Configuration
- **Shadow Map Resolution**: Increased from default 1024 to 2048 for sharper shadows
- **Cascaded Shadow Maps**: Now using 2 cascades for better shadow quality at varying distances
- **Bias Settings**: 
  - Constant bias: 0.0005 (reduces shadow acne)
  - Normal bias: 1.5 (reduces peter-panning)
- **Shadow Hints**: Configured near (0.1) and far (200.0) hints for optimized shadow frustum
- **Stable Shadows**: Enabled for temporal consistency
- **Polygon Offset**: Set to 0.2 constant, 1.0 slope for depth fighting prevention
- **Screen Space Contact Shadows**: Enabled for enhanced contact detail
- **Step Count**: Increased to 16 for smoother PCF filtering

#### VSM (Variance Shadow Mapping) Support
```javascript
// Softer shadows with VSM
this.view.setVsmShadowOptions({
    anisotropy: 1,
    mipmapping: true,
    msaaSamples: 4,
    highPrecision: true,
    minVarianceScale: 0.5,
    lightBleedReduction: 0.2
})
```

#### Soft Shadow Penumbra
```javascript
// PCSS-like soft shadows
this.view.setSoftShadowOptions({
    penumbraScale: 2.0,
    penumbraRatioScale: 0.5
})
```

### Changes in `src/zone-methods.js`

- Updated `setNightMode()` to use enhanced shadow settings for night lighting

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

## 5. Future Enhancements

### Immediate Next Steps:
1. **Texture Sampling**: Add actual texture loading support when `custom_material_enhanced.mat` is compiled
2. **Cube Environment Maps**: Add reflection probes for metallic marbles
3. **Subsurface Scattering**: For translucent marble materials

### Advanced Features (for end of day):
1. **Image-Based Lighting (IBL)**: HDRI environment maps for realistic reflections
2. **Dynamic Environment Mapping**: Real-time reflections for shiny surfaces
3. **Volumetric Effects**: Light shafts, god rays in the course
4. **Screen Space Reflections (SSR)**: For real-time reflections on the course

## Usage

To use the enhanced shadows, no code changes are required - they're automatically applied via `setupPostProcessing()`.

To use material presets with marbles, add to `marbles_data.js`:

```javascript
{
    name: "Polished Gold",
    color: [1.0, 0.84, 0.0],
    materialType: "shinyMetal", // Uses preset
    roughness: 0.1,
    metallic: 1.0,
    reflectance: 1.0,
    clearCoat: 0.5,
    // ... other properties
}
```

## Technical Notes

### Shader Compilation
The enhanced material (`custom_material_procedural.mat`) needs to be compiled with Filament's `matc` tool:

```bash
matc -p web -o baked_enhanced.filmat custom_material_procedural.mat
```

### Performance Considerations
- Shadow map 2048x2048 with 2 cascades: Moderate GPU cost
- VSM with mipmapping: Higher quality but more memory
- Procedural bump in shader: Very low cost (just noise math)
- Soft shadows: Adjustable penumbra scale for quality/performance tradeoff

### Browser Compatibility
All enhancements use standard WebGL2 features. Requires:
- WebGL2 support
- Floating point textures
- Multiple render targets (for shadows)
