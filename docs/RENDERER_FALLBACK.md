# Renderer Fallback

Marbles renders with Google Filament (WebGL2). WebGPU is optional: the boot probe (`src/webgpu/boot-probe.js`, see [WEBGPU_BOOT_PROBE.md](WEBGPU_BOOT_PROBE.md)) only provides a device for the compute overlay (particles, gpu-chores). If the probe fails, Filament still boots and the overlay work runs on the CPU.

## Selecting a renderer

The player default is **Filament**, whether or not the WebGPU probe passed.

The simplified WebGL2 debug renderer (`SimpleDebugRenderer`) is a **dev / e2e route** chosen from the URL only:

```text
/?renderer=simple
/?renderer=webgl
/?webgl
/?simpleRenderer
/?debugRenderer
```

`getRequestedRendererMode()` (`src/rendering/simple-debug-renderer.js`) reads only the URL. A `marbles.rendererMode` value stored in `localStorage` is ignored, so a player can't get stuck in the debug view. The in-page renderer panel has no "Simple" button, only "Filament", which returns to the default route.

`/?renderer=filament` (or `full`) is accepted and only marks the choice as explicit.

## Fallback matrix

| Situation | Renderer | GPU compute | `rendererFallbackReason` |
|---|---|---|---|
| WebGPU probe passes | Filament | WebGPU overlay (when `?webgpuParticles=1`) | empty |
| WebGPU probe fails (no `navigator.gpu`, no adapter, `requestDevice` rejects) | Filament | CPU | `WebGPU unavailable (…)` |
| Filament script fails to load, or `Engine.create()` throws | Simple WebGL2 (last resort) | none | `Filament load failed: …` / `Filament engine failed: …` |
| `?renderer=simple` | Simple WebGL2 | none | empty, or the WebGPU reason |

The last-resort row is a recovery path, not a supported mode, so expect a debug-only view.

## Runtime Breadcrumbs

Automation can inspect these globals after startup:

```javascript
window.webgpuProbe               // boot-probe result (browser, adapter info, features, requested features/limits, errors, device loss)
window.rendererType              // "filament", or "simple-webgl" (URL flag or last-resort recovery)
window.usingFilament             // true for the full renderer
window.usingSimpleRenderer       // true for the debug renderer
window.usingWebGL                // true for both renderers
window.rendererFallbackReason    // why WebGPU or Filament was unavailable; empty otherwise
window.simpleRendererFrameStats  // vertex/triangle/entity counts (simple renderer only)
window.gameReady                 // true after init resolves
```

## Shared State Contract (simple renderer)

When the simple renderer is active it uses the same `MarblesGame` instance, Rapier world, level loader, marble definitions, input state, and game loop. A small Filament-like adapter sits in front of it, so entity creation and `TransformManager.setTransform()` calls still run.

It draws a top-down WebGL2 debug view: grid and axes, static and dynamic boxes from the shared transforms, live marble positions, and a highlighted active marble. It is intentionally not a visual-parity renderer. It has no Filament PBR materials, IBL, shadows, particles, fog, post-processing, or exact camera composition.

## Canvas alpha

Filament's canvas is created with `alpha: false` (`src/rendering-defaults.js`). It is the opaque bottom layer, and an alpha backbuffer would let the page background show through. The WebGPU particle overlay above it is configured `alphaMode: 'premultiplied'`, `colorSpace: 'srgb'`, so it composites over Filament in the same color space.

## Debugging Notes

Playwright smoke tests run against Filament by default. Use `?renderer=simple` to split a bug between "game state" and "Filament": if it reproduces in the simple view, look at Rapier state, level data, and shared transform sync (`src/game-loop/sync.js`) before suspecting Filament asset, material, camera, or post-processing code.
