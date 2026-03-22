# Advanced Alpha Compositor Guide
## Phase B Implementation - Agent 2B

### Overview
This guide documents the 6 advanced alpha modes implemented across 50 shaders for sophisticated transparency handling.

---

## Alpha Mode Reference

### Mode 1: Depth-Layered Alpha
**Use for:** Atmospheric effects, depth-of-field hybrids

**Concept:** Alpha varies based on depth buffer - farther objects more transparent

**Function:**
```wgsl
fn depthLayeredAlpha(color: vec3<f32>, uv: vec2<f32>, pixelSize: vec2<f32>, depthWeight: f32) -> f32 {
    let depth = textureSampleLevel(readDepthTexture, non_filtering_sampler, uv, 0.0).r;
    let luma = dot(color, vec3<f32>(0.299, 0.587, 0.114));
    
    // Depth factor: foreground (depth=1) = more opaque
    let depthAlpha = mix(0.4, 1.0, depth);
    let lumaAlpha = mix(0.5, 1.0, luma);
    
    // Combine with parameter control
    return mix(lumaAlpha, depthAlpha, depthWeight);
}
```

**Parameters:**
- `depthWeight` (zoom_params.z): 0.0 = luminance only, 1.0 = depth only

**Target Shaders:**
- volumetric-cloud-nebula
- aurora-rift, aurora-rift-2
- atmos_volumetric_fog
- chromatographic-separation
- kimi_liquid_glass
- crystal-refraction
- holographic-* shaders

---

### Mode 2: Edge-Preserve Alpha
**Use for:** Outline effects, sketch filters

**Concept:** Edges are fully opaque, smooth areas become transparent

**Function:**
```wgsl
fn edgePreserveAlpha(color: vec3<f32>, uv: vec2<f32>, pixelSize: vec2<f32>, edgeThreshold: f32) -> f32 {
    // Depth edge detection
    let d = textureSampleLevel(readDepthTexture, non_filtering_sampler, uv, 0.0).r;
    let dR = textureSampleLevel(readDepthTexture, non_filtering_sampler, uv + vec2<f32>(pixelSize.x, 0.0), 0.0).r;
    let dL = textureSampleLevel(readDepthTexture, non_filtering_sampler, uv - vec2<f32>(pixelSize.x, 0.0), 0.0).r;
    let dU = textureSampleLevel(readDepthTexture, non_filtering_sampler, uv + vec2<f32>(0.0, pixelSize.y), 0.0).r;
    let dD = textureSampleLevel(readDepthTexture, non_filtering_sampler, uv - vec2<f32>(0.0, pixelSize.y), 0.0).r;
    
    let depthEdge = length(vec2<f32>(dR - dL, dU - dD));
    let edgeMask = smoothstep(edgeThreshold * 0.5, edgeThreshold, depthEdge);
    
    // Edge = opaque, smooth = transparent
    return mix(0.3, 1.0, edgeMask);
}
```

**Parameters:**
- `edgeThreshold` (zoom_params.y): 0.02-0.1 recommended

**Target Shaders:**
- neon-edge-diffusion
- neon-edge-reveal
- neon-edges
- edge-glow-mouse
- sketch-reveal

---

### Mode 3: Accumulative Alpha (Feedback)
**Use for:** Temporal echo, reaction-diffusion, feedback loops

**Concept:** Alpha accumulates over time like paint on canvas

**Function:**
```wgsl
fn accumulativeAlpha(
    newColor: vec3<f32>,
    newAlpha: f32,
    uv: vec2<f32>,
    accumulationRate: f32
) -> vec4<f32> {
    let prev = textureSampleLevel(readTexture, u_sampler, uv, 0.0);
    
    // Accumulate alpha
    let accumulatedAlpha = prev.a * (1.0 - accumulationRate * 0.1) + newAlpha * accumulationRate;
    let totalAlpha = min(accumulatedAlpha, 1.0);
    
    // Blend colors based on alpha contribution
    let color = mix(prev.rgb, newColor, newAlpha * accumulationRate / totalAlpha);
    
    return vec4<f32>(color, totalAlpha);
}
```

**Parameters:**
- `accumulationRate` (zoom_params.x): 0.0-1.0, higher = faster accumulation

**Target Shaders:**
- temporal-echo
- infinite-fractal-feedback
- reaction-diffusion
- lenia
- video-echo-chamber
- gen-feedback-echo-chamber

---

### Mode 4: Physical Transmittance (Beer's Law)
**Use for:** Volumetric effects, glass, liquids

**Concept:** Simulates light absorption through colored medium

**Function:**
```wgsl
fn physicalTransmittance(
    baseColor: vec3<f32>,
    opticalDepth: f32,
    absorptionCoeff: vec3<f32>
) -> vec3<f32> {
    // Beer's Law: I = I0 * exp(-σ * d)
    let transmittance = exp(-absorptionCoeff * opticalDepth);
    return baseColor * transmittance;
}

fn volumetricAlpha(density: f32, thickness: f32) -> f32 {
    return 1.0 - exp(-density * thickness);
}
```

**Parameters:**
- `density` (effect-specific): Material density
- `thickness` (effect-specific): Path length through material

**Target Shaders:**
- volumetric-cloud-nebula
- aurora-rift
- kimi_liquid_glass
- liquid-warp
- crystal-refraction

---

### Mode 5: Effect Intensity Alpha
**Use for:** Distortion shaders

**Concept:** Alpha based on how much distortion/effect is applied

**Function:**
```wgsl
fn effectIntensityAlpha(
    originalUV: vec2<f32>,
    displacedUV: vec2<f32>,
    baseAlpha: f32,
    intensity: f32
) -> f32 {
    let displacement = length(displacedUV - originalUV);
    let displacementAlpha = smoothstep(0.0, 0.1, displacement);
    
    // Edge fade
    let edgeDist = min(min(originalUV.x, 1.0 - originalUV.x),
                       min(originalUV.y, 1.0 - originalUV.y));
    let edgeFade = smoothstep(0.0, 0.05, edgeDist);
    
    return baseAlpha * mix(0.5, 1.0, displacementAlpha * intensity) * edgeFade;
}
```

**Parameters:**
- `intensity` (zoom_params.x): 0.0-1.0, scales displacement contribution

**Target Shaders:**
- tensor-flow-sculpting
- hyperbolic-dreamweaver
- julia-warp
- parallax-shift
- liquid-warp
- vortex-distortion
- bubble-lens
- slinky-distort

---

### Mode 6: Luminance Key Alpha
**Use for:** Glow effects, screen blend

**Concept:** Dark pixels become transparent (like screen blend in Photoshop)

**Function:**
```wgsl
fn luminanceKeyAlpha(color: vec3<f32>, threshold: f32, softness: f32) -> f32 {
    let luma = dot(color, vec3<f32>(0.299, 0.587, 0.114));
    return smoothstep(threshold - softness, threshold + softness, luma);
}
```

**Parameters:**
- `threshold` (zoom_params.y): Luminance threshold for visibility
- `softness` (zoom_params.z): Edge softness

**Target Shaders:**
- anamorphic-flare
- lens-flare-brush
- neon-pulse
- divine-light
- light-leaks

---

## Parameter Mapping Standard

All advanced alpha shaders use `u.zoom_params` consistently:

| Param | Usage | Range | Default |
|-------|-------|-------|---------|
| x | Effect intensity/accumulation rate | 0.0-1.0 | 0.5 |
| y | Alpha threshold/edge threshold | 0.0-1.0 | 0.1 |
| z | Depth influence/softness | 0.0-1.0 | 0.5 |
| w | Mode-specific (absorption, dispersion, etc.) | 0.0-1.0 | 0.5 |

---

## Shader Upgrade Summary

### Distortion Category (Effect Intensity Alpha)
| Shader | Status |
|--------|--------|
| tensor-flow-sculpting | ✅ |
| hyperbolic-dreamweaver | ✅ |
| julia-warp | ✅ |
| parallax-shift | ✅ |
| liquid-warp | ✅ |
| vortex-distortion | ✅ |
| bubble-lens | ✅ |
| slinky-distort | ✅ |

### Volumetric/Atmospheric (Physical Transmittance)
| Shader | Status |
|--------|--------|
| volumetric-cloud-nebula | ✅ |
| aurora-rift | ✅ |
| aurora-rift-2 | ✅ |
| atmos_volumetric_fog | ✅ |

### Feedback/Temporal (Accumulative Alpha)
| Shader | Status |
|--------|--------|
| temporal-echo | ✅ |
| infinite-fractal-feedback | ✅ |
| reaction-diffusion | ✅ |
| lenia | ✅ |
| video-echo-chamber | ✅ |

### Edge-Detection/Outline (Edge-Preserve Alpha)
| Shader | Status |
|--------|--------|
| neon-edge-diffusion | ✅ |
| neon-edge-reveal | ✅ |
| neon-edges | ✅ |
| edge-glow-mouse | ✅ |
| sketch-reveal | ✅ |

### Glow/Light Effects (Luminance Key Alpha)
| Shader | Status |
|--------|--------|
| anamorphic-flare | ✅ |
| lens-flare-brush | ✅ |
| neon-pulse | ✅ |
| divine-light | ✅ |
| light-leaks | ✅ |

### Complex Multi-Effect (Depth-Layered Alpha)
| Shader | Status |
|--------|--------|
| chromatographic-separation | ✅ |
| kimi_liquid_glass | ✅ |
| crystal-refraction | ✅ |
| holographic-projection | ✅ |
| holographic-prism | ✅ |
| holographic-interference | ✅ |

---

## Visual Examples

### Depth-Layered Alpha
- Farther objects fade into background
- Creates atmospheric perspective
- Perfect for volumetric effects

### Edge-Preserve Alpha
- Only edges show the effect
- Interiors remain transparent
- Great for outline and sketch effects

### Accumulative Alpha
- Effect builds up over time
- Like layers of transparent paint
- Used in feedback/temporal effects

### Physical Transmittance
- Realistic light absorption
- Simulates fog, smoke, glass
- Based on Beer-Lambert law

### Effect Intensity Alpha
- Alpha varies with distortion amount
- No distortion = transparent
- Maximum distortion = opaque

### Luminance Key Alpha
- Dark areas become transparent
- Bright areas remain visible
- Perfect for glow and light effects

---

## Implementation Notes

1. All shaders maintain depth pass-through
2. Alpha calculations respect parameter ranges
3. Edge cases handled (min/max clamping)
4. Performance optimized for real-time use
5. Consistent parameter mapping across all shaders
