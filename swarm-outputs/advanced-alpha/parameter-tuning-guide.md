# Advanced Alpha Parameter Tuning Guide

## Quick Reference

### Parameter Mapping (zoom_params)

| Param | Standard Usage | Range | Typical Default |
|-------|---------------|-------|-----------------|
| x | Effect intensity / accumulation rate | 0.0-1.0 | 0.5 |
| y | Alpha threshold / edge threshold | 0.0-1.0 | 0.1 |
| z | Depth influence / softness | 0.0-1.0 | 0.5 |
| w | Mode-specific parameter | 0.0-1.0 | 0.5 |

---

## Mode-Specific Tuning

### 1. Depth-Layered Alpha (Atmospheric Effects)

**Usage:** `volumetric-cloud-nebula`, `aurora-rift`, `atmospheric-fog`

**Parameters:**
- `zoom_params.x`: Cloud density / intensity
- `zoom_params.z`: Depth weight (0.0 = luminance only, 1.0 = depth only)

**Tuning Tips:**
- Increase depth weight for stronger atmospheric perspective
- Lower values (0.2-0.4) for subtle depth cues
- Higher values (0.6-0.9) for dramatic foreground/background separation

**Example Settings:**
```
Density: 0.6      // Medium cloud density
Threshold: 0.1    // Standard threshold
Depth Weight: 0.7 // Strong depth layering
Mode Param: 0.5   // Additional density
```

---

### 2. Edge-Preserve Alpha (Outline Effects)

**Usage:** `neon-edge-diffusion`, `sketch-reveal`, `neon-edges`

**Parameters:**
- `zoom_params.x`: Edge threshold (0.02-0.1)
- `zoom_params.y`: Luminance threshold
- `zoom_params.z`: Depth influence

**Tuning Tips:**
- Lower edge threshold = more edges detected
- Increase depth influence for depth-aware edge fading
- Combine with high glow intensity for neon effects

**Example Settings:**
```
Edge Threshold: 0.05  // Sensitive edge detection
Luma Threshold: 0.2   // Low luminance cutoff
Depth Weight: 0.5     // Moderate depth influence
Glow Intensity: 0.8   // Strong glow
```

---

### 3. Accumulative Alpha (Feedback Effects)

**Usage:** `temporal-echo`, `reaction-diffusion`, `video-echo-chamber`

**Parameters:**
- `zoom_params.x`: Accumulation rate (0.0-1.0)
- `zoom_params.y`: Decay / echo strength
- `zoom_params.z`: Depth influence

**Tuning Tips:**
- Higher accumulation = faster build-up but potential saturation
- Lower values (0.1-0.3) for subtle temporal trails
- Higher values (0.5-0.9) for paint-like accumulation

**Example Settings:**
```
Accumulation: 0.3  // Moderate build-up
Decay: 0.8        // Slow fade
Depth Weight: 0.4  // Some depth variation
Feedback: 0.6     // Strong feedback
```

---

### 4. Physical Transmittance (Volumetric Effects)

**Usage:** `volumetric-cloud-nebula`, `liquid-glass`, `fire-smoke`

**Parameters:**
- `zoom_params.x`: Density / optical depth
- `zoom_params.y`: Absorption color shift
- `zoom_params.z`: Depth weight
- `zoom_params.w`: Scattering amount

**Tuning Tips:**
- Density controls overall opacity
- Color shift affects absorption tint
- Based on Beer-Lambert law: I = I₀ * exp(-σ * d)

**Example Settings:**
```
Density: 0.8       // High density fog
Color Shift: 0.3   // Blue-tinted absorption
Depth Weight: 0.6  // Depth-aware
Scattering: 0.5    // Medium scattering
```

---

### 5. Effect Intensity Alpha (Distortion Effects)

**Usage:** `tensor-flow-sculpting`, `vortex-distortion`, `julia-warp`

**Parameters:**
- `zoom_params.x`: Effect intensity / distortion amount
- `zoom_params.z`: Depth weight
- `zoom_params.w`: Additional effect parameter

**Tuning Tips:**
- Alpha increases with displacement magnitude
- Edge fade prevents artifacts at screen boundaries
- Combine with depth weight for layered distortion

**Example Settings:**
```
Intensity: 0.7     // Strong distortion
Threshold: 0.1    // Standard
Depth Weight: 0.5 // Moderate depth influence
Edge Softness: 0.2
```

---

### 6. Luminance Key Alpha (Glow Effects)

**Usage:** `anamorphic-flare`, `light-leaks`, `neon-pulse`

**Parameters:**
- `zoom_params.x`: Intensity / brightness
- `zoom_params.y`: Luminance threshold (0.0-0.5)
- `zoom_params.z`: Softness (0.0-0.3)
- `zoom_params.w`: Color shift

**Tuning Tips:**
- Lower threshold = more pixels visible
- Softness controls edge feathering
- Like screen blend mode in Photoshop

**Example Settings:**
```
Intensity: 1.0     // Full brightness
Luma Threshold: 0.15 // Show dim areas
Softness: 0.15    // Gentle edges
Color Shift: 0.5  // Medium shift
```

---

## Visual Quality Guidelines

### Avoiding Artifacts

1. **Edge Clamping:** Always clamp UV coordinates when sampling
2. **Alpha Saturation:** Use `min(alpha, 1.0)` to prevent overflow
3. **Division by Zero:** Check for zero before division in blend calculations
4. **Depth Precision:** Sample depth at mip level 0 for accuracy

### Performance Optimization

1. **Combine Alpha Calculations:** Calculate all alpha modes in one function
2. **Early Exit:** Return early for pixels outside effect radius
3. **Texture Sampling:** Minimize texture samples (group fetches)
4. **Branching:** Avoid dynamic branches in hot loops

### Recommended Combinations

**Atmospheric Scenes:**
- Depth-Layered + Physical Transmittance
- High depth weight (0.7-0.9)
- Medium density (0.5-0.7)

**Neon/Glow Effects:**
- Luminance Key + Edge-Preserve
- Low threshold (0.1-0.2)
- High softness (0.2-0.3)

**Distortion Effects:**
- Effect Intensity + Depth-Layered
- Medium intensity (0.5-0.7)
- Edge fade enabled

**Feedback/Temporal:**
- Accumulative + Luminance Key
- Low accumulation rate (0.2-0.4)
- Medium decay (0.7-0.9)

---

## Common Issues & Solutions

### Issue: Alpha Too Transparent
**Solution:** Increase `zoom_params.x` (intensity/accumulation)

### Issue: Hard Edges Visible
**Solution:** Increase `zoom_params.z` (softness) or use smoothstep

### Issue: Depth Artifacts
**Solution:** Ensure depth texture is sampled with `non_filtering_sampler`

### Issue: Feedback Saturation
**Solution:** Lower accumulation rate or increase decay

### Issue: Glow Bleeding
**Solution:** Increase luminance threshold or decrease softness

---

## Shader-Specific Recommendations

### Volumetric Cloud Nebula
- Physical Transmittance with high density (0.8)
- Medium depth weight (0.5) for atmospheric depth

### Neon Edge Effects
- Edge-Preserve with low threshold (0.02-0.05)
- Combine with luminance key for glow control

### Temporal Echo
- Acculative alpha with low rate (0.2-0.3)
- Depth weight for distance-based fade

### Liquid/Glass Shaders
- Physical Transmittance with Fresnel
- Effect Intensity for displacement-based alpha

### Holographic Effects
- Depth-Layered with medium weight (0.5)
- Luminance Key for dark area transparency
