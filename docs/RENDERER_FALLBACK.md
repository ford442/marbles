# Renderer Fallback

Marbles defaults to the full Google Filament renderer. For physics-visual debugging, browser automation, and agent iteration, the app also has an opt-in simplified WebGL2 renderer.

## Usage

Use one of these routes:

```text
/?renderer=filament
/?renderer=simple
/?renderer=webgl
/?webgl
/?simpleRenderer
```

The in-page renderer toggle stores the choice in `localStorage` and reloads with `?renderer=filament` or `?renderer=simple`.

Filament remains the default. If Filament fails to load or its engine cannot be created, startup falls back to the simple WebGL2 renderer and records the reason in `window.rendererFallbackReason`.

## Runtime Breadcrumbs

Automation can inspect these globals after startup:

```javascript
window.rendererType              // "filament" or "simple-webgl"
window.usingFilament             // true for the full renderer
window.usingSimpleRenderer       // true for the debug renderer
window.usingWebGL                // true for both current renderers
window.rendererFallbackReason    // empty unless fallback was automatic
window.simpleRendererFrameStats  // vertex/triangle/entity counts for simple mode
window.gameReady                 // true after init resolves
```

## Shared State Contract

Both renderer modes use the same `MarblesGame` instance, Rapier world, level loader, marble definitions, input state, and game loop. The simple renderer presents a small Filament-like adapter so existing entity creation and `TransformManager.setTransform()` calls still run. That keeps physics state, scene data, and gameplay interactions shared instead of forking the simulation.

The simplified renderer draws a top-down WebGL2 debug view:

- grid and world axes
- static and dynamic renderable boxes from shared entity transforms
- live marble positions from Rapier rigid bodies
- highlighted active marble

It is intentionally not a visual parity renderer. It does not reproduce Filament PBR materials, IBL, shadows, particles, fog, post-processing, or exact camera composition. Use it to verify physics movement, transforms, level geometry placement, and interaction state when full Filament debugging is noisy or hard to automate.

## Debugging Notes

Prefer `?renderer=simple` for Playwright smoke tests that need deterministic canvas activity and readable runtime state. Prefer `?renderer=filament` for material, lighting, post-processing, and final visual regressions.

When a bug appears only in Filament, compare the same level and interaction in `?renderer=simple`. If the simple route has correct body positions and level layout, the issue is likely in Filament asset/material/camera/post-processing code. If both routes are wrong, start from Rapier state, level data, or shared transform sync.
