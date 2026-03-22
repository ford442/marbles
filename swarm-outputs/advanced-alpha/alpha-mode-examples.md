# Alpha Mode Examples - Visual Guide

## Mode 1: Depth-Layered Alpha

### Visual Effect
- Distant objects fade into background
- Creates atmospheric perspective
- Foreground elements remain opaque
- Background elements become transparent

### Best Used For
- Volumetric clouds and fog
- Atmospheric effects
- Depth-of-field hybrids
- Distance-based transparency

### Example Shaders
- `volumetric-cloud-nebula` - Clouds fade with depth
- `aurora-rift` - Aurora curtains layer with depth
- `atmos_volumetric_fog` - Fog density varies by distance
- `chromatographic-separation` - RGB separation depth-based

### Visual Example
```
Foreground (depth=1.0):  ████████████  alpha=1.0 (opaque)
Mid-ground (depth=0.5):  ████████░░░░  alpha=0.7
Background (depth=0.0):  ████░░░░░░░░  alpha=0.4 (transparent)
```

---

## Mode 2: Edge-Preserve Alpha

### Visual Effect
- Only edges show the effect
- Interiors remain transparent
- Creates outline/sketch appearance
- Preserves object silhouettes

### Best Used For
- Outline effects
- Sketch filters
- Edge detection visualization
- Neon edge glows

### Example Shaders
- `neon-edge-diffusion` - Edges glow, interiors clear
- `neon-edge-reveal` - Flashlight reveals edges
- `neon-edges` - Sobel edge detection with neon
- `sketch-reveal` - Sketch drawing effect
- `edge-glow-mouse` - Mouse-controlled edge glow

### Visual Example
```
Input:          Edge-Preserve Output:
┌──────┐        ░░┌────┐░░
│      │   →    ░░│    │░░
│      │        ░░│    │░░
└──────┘        ░░└────┘░░
                (edges opaque, interior transparent)
```

---

## Mode 3: Accumulative Alpha (Feedback)

### Visual Effect
- Effect builds up over time
- Like layers of transparent paint
- Old frames fade gradually
- New frames add on top

### Best Used For
- Temporal echo effects
- Video feedback loops
- Paint accumulation
- Reaction-diffusion

### Example Shaders
- `temporal-echo` - Frame history accumulation
- `infinite-fractal-feedback` - Recursive feedback
- `reaction-diffusion` - Chemical pattern formation
- `lenia` - Continuous cellular automata
- `video-echo-chamber` - Multi-layer echo
- `optical-feedback` - Camera feedback simulation

### Visual Example
```
Frame 1:  ████░░░░░░░░  alpha=0.3
Frame 2:  ██████░░░░░░  alpha=0.5  (accumulated)
Frame 3:  ████████░░░░  alpha=0.7  (accumulated)
Frame 4:  ██████████░░  alpha=0.9  (saturated)
```

---

## Mode 4: Physical Transmittance (Beer's Law)

### Visual Effect
- Realistic light absorption
- Thicker/denser areas more opaque
- Colored absorption (wavelength-dependent)
- Exponential falloff

### Best Used For
- Volumetric fog/smoke
- Glass and liquids
- Fire and explosions
- Any light-scattering medium

### Example Shaders
- `volumetric-cloud-nebula` - Cloud light scattering
- `fire_smoke_volumetric` - Fire and smoke physics
- `kimi_liquid_glass` - Glass refraction
- `atmos_volumetric_fog` - Atmospheric fog

### Visual Example
```
Thin (d=0.2):   ████░░░░░░░░  I = I₀ * exp(-σ*0.2)  (mostly transmitted)
Medium (d=0.5): ███████░░░░░  I = I₀ * exp(-σ*0.5)  (partially absorbed)
Thick (d=1.0):  ███████████░  I = I₀ * exp(-σ*1.0)  (mostly absorbed)
```

---

## Mode 5: Effect Intensity Alpha

### Visual Effect
- Alpha varies with distortion amount
- No distortion = transparent
- Maximum distortion = opaque
- Creates "active area" highlighting

### Best Used For
- Distortion shaders
- Warp effects
- Liquid simulations
- Displacement effects

### Example Shaders
- `tensor-flow-sculpting` - Tensor warp intensity
- `julia-warp` - Fractal distortion
- `parallax-shift` - Parallax displacement
- `vortex-distortion` - Vortex twist
- `bubble-lens` - Lens magnification
- `slinky-distort` - Spiral distortion

### Visual Example
```
No distortion:  ░░░░░░░░░░░░  alpha=0.3 (base)
Low distortion: ███░░░░░░░░░  alpha=0.5
Med distortion: ██████░░░░░░  alpha=0.7
High distortion:████████████  alpha=1.0
```

---

## Mode 6: Luminance Key Alpha

### Visual Effect
- Dark pixels transparent
- Bright pixels opaque
- Smooth threshold transition
- Like "screen" blend mode

### Best Used For
- Glow effects
- Light leaks
- Lens flares
- Screen blend effects

### Example Shaders
- `anamorphic-flare` - Lens flare glow
- `lens-flare-brush` - Paintable flares
- `light-leaks` - Film light leaks
- `neon-pulse` - Pulsing glow
- `divine-light` - God rays

### Visual Example
```
Dark (luma=0.1):   ░░░░░░░░░░░░  alpha=0.0 (transparent)
Mid (luma=0.3):    ██░░░░░░░░░░  alpha=0.2
Bright (luma=0.7): ███████░░░░░  alpha=0.8
Max (luma=1.0):    ████████████  alpha=1.0 (opaque)
```

---

## Combination Examples

### Depth-Layered + Physical Transmittance
**Used in:** `volumetric-cloud-nebula`, `aurora-rift`
```
Effect: Clouds have both depth-based fade AND physical density
Result: Realistic atmospheric perspective with volumetric lighting
```

### Edge-Preserve + Luminance Key
**Used in:** `neon-edges`, `neon-edge-pulse`
```
Effect: Edges are preserved AND bright areas glow
Result: Clean neon outline with controlled glow intensity
```

### Accumulative + Depth-Layered
**Used in:** `temporal-echo`, `video-echo-chamber`
```
Effect: Frames accumulate AND depth affects visibility
Result: Temporal trails that fade with distance
```

### Effect Intensity + Depth-Layered
**Used in:** `tensor-flow-sculpting`, `parallax-shift`
```
Effect: Distortion affects alpha AND depth layering
Result: Warped areas with atmospheric depth
```

---

## Parameter Visualizations

### Depth Weight (zoom_params.z)
```
0.0:  Only luminance affects alpha
0.5:  Equal luminance and depth influence
1.0:  Only depth affects alpha (full depth-layered)
```

### Threshold (zoom_params.y)
```
0.05: Very sensitive, many pixels visible
0.15: Balanced visibility
0.30: Strict threshold, only bright/dense areas visible
```

### Softness (zoom_params.z/w)
```
0.02: Hard edges, sharp transitions
0.10: Medium softness, natural falloff
0.25: Very soft, feathered edges
```

### Accumulation Rate (zoom_params.x)
```
0.1:  Slow build-up, long trails
0.3:  Medium accumulation
0.7:  Fast saturation, quick paint effect
```
