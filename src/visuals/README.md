# Marble Visual System

A complete visual overhaul module for the marbles game, integrating PBR materials, procedural textures, particle effects, and LOD management.

## Files

| File | Purpose | Size |
|------|---------|------|
| `MarbleVisual.ts` | Main module with all visual systems | 37KB |
| `INTEGRATION_GUIDE.md` | Step-by-step integration instructions | 5KB |
| `MARBLE_VISUAL_OVERHAUL_SUMMARY.json` | Complete summary of changes & specs | 7.5KB |
| `MAIN_JS_INTEGRATION_EXAMPLE.js` | Copy-paste integration code | 14KB |
| `MarbleVisual.test.js` | Test suite and performance benchmark | 9KB |
| `README.md` | This file | - |

## Quick Start

```bash
# 1. Copy the visual system to your project
cp src/visuals/MarbleVisual.ts your-project/src/visuals/

# 2. Follow the integration guide
cat INTEGRATION_GUIDE.md

# 3. Run the test suite
node src/visuals/MarbleVisual.test.js
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MarbleVisual (Main)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Material   │  │   Particle   │  │      LOD        │   │
│  │   Builder    │  │    System    │  │    Manager      │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │        ProceduralTextureGenerator (Shared)           │  │
│  │  - Noise textures  - Vein patterns  - Normal maps   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Features by Theme

### Classic Glass
- ClearCoat for polished surface
- Transmission/Refraction (IOR 1.5)
- Speed-based refraction modulation
- Impact distortion effect

### Obsidian Metal
- High metallic (0.95), low roughness (0.15)
- Procedural noise roughness map
- Strong rim lighting (purple-tinted)
- Angular velocity roughness modulation

### Neon Glow
- Emissive glow with bloom support
- Pulsing animation (3Hz base, 15Hz boost)
- Speed-based color shifting
- Boost mode flash effect

### Stone Vein
- Procedural vein texture generation
- Normal mapping for surface detail
- Ambient occlusion
- No particles (optimization)

## Performance

| LOD Level | Particles | Material | Update Time |
|-----------|-----------|----------|-------------|
| HIGH      | Yes       | Full     | ~0.35ms     |
| MEDIUM    | Reduced   | Simplified | ~0.20ms   |
| LOW       | No        | Basic    | ~0.10ms     |
| CULLED    | No        | N/A      | 0ms         |

**Target**: < 0.5ms per marble @ 60fps

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 15+ (WebGL2)
- Edge 80+

Requires WebGL2 with floating point texture support.

## License

Part of the Codepit marbles project.
