# WebGPU Compute Evaluation for Marbles 3D

## Executive Summary

WebGPU offers significant potential for the Marbles 3D project, primarily through **compute shaders** for particle simulation, procedural texture generation, and GPU-driven culling. However, **Filament does not yet have a stable WebGPU backend** (as of Filament 1.51.5), which creates architectural friction.

**Verdict:** Adopt a **dual-renderer research track** — keep the proven Filament WebGL2 pipeline for rendering, but prototype WebGPU compute passes for physics particles and procedural generation using a separate canvas/context that composites over Filament's output.

---

## Current WebGPU Landscape

### Browser Support (May 2026)
- **Chrome/Edge:** Full support, stable
- **Firefox:** Full support, stable
- **Safari:** Full support (macOS 15+, iOS 18+)
- **Market coverage:** ~85% of desktop users, ~70% of mobile

### Filament WebGPU Status
- Google is actively developing a WebGPU backend for Filament
- Expected in a major release (possibly 2.x), but no public timeline
- The current JS bindings (`filament.js` / `filament.wasm`) are WebGL2-only
- **Implication:** We cannot simply "flip a switch" to WebGPU rendering

---

## Highest-Value WebGPU Compute Use Cases

### 1. GPU Particle Simulation (Highest Impact)
**Current State:** CPU updates ~200 particles per frame in `game-loop-sync-methods.js`
**WebGPU Upgrade:** Compute shader handles 10,000+ particles at negligible CPU cost

```wgsl
// compute_particles.wgsl
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    if (idx >= arrayLength(&particles)) { return; }

    var p = particles[idx];
    p.velocity += params.gravity * params.deltaTime;
    p.velocity *= (1.0 - params.drag * params.deltaTime);
    p.position += p.velocity * params.deltaTime;
    p.life -= params.deltaTime;

    particles[idx] = p;
}
```

**Benefits:**
- 50× particle count increase
- Zero CPU overhead for simulation
- Enables complex effects (fluid-like smoke, debris fields)

**Integration Path:**
1. Create offscreen WebGPU canvas/context
2. Run compute pass each frame
3. Render particles as point sprites or billboards
4. Composite over Filament's canvas using `canvas.copyExternalImageToTexture()` or DOM overlay

### 2. Procedural Texture Generation (High Impact)
**Current State:** Canvas 2D generates 256×256 noise textures on CPU
**WebGPU Upgrade:** Compute shader generates 1024×1024 3D noise / vein patterns in parallel

```wgsl
// compute_noise.wgsl
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let uv = vec2<f32>(id.xy) / vec2<f32>(textureDimensions(output));
    let noise = fbm(uv * 16.0, 4);
    textureStore(output, id.xy, vec4<f32>(noise, noise, noise, 1.0));
}
```

**Benefits:**
- 4× texture resolution
- Near-instant generation (milliseconds vs. tens of milliseconds)
- Enables runtime generation of normal maps, roughness maps, AO

### 3. GPU-Driven Culling & LOD (Medium Impact)
**Current State:** All zone entities rendered regardless of visibility
**WebGPU Upgrade:** Compute shader performs frustum/occlusion culling, outputs indirect draw commands

**Benefits:**
- 30-60% reduction in draw calls for large levels
- Automatic LOD selection based on distance

### 4. Physics Broad-Phase Acceleration (Research)
**Current State:** Rapier3D handles all physics on CPU
**WebGPU Upgrade:** GPU-accelerated spatial hash or BVH construction

**Risks:**
- Rapier does not support GPU physics
- Would require a custom physics engine or GPU broad-phase hybrid
- **Recommendation:** Defer until Rapier adds GPU support or project outg Rapier

---

## Dual-Renderer Architecture Proposal

```
┌─────────────────────────────────────────┐
│           DOM / HTML Overlay            │
│         (HUD, UI, speed lines)          │
├─────────────────────────────────────────┤
│    WebGPU Canvas (particles, effects)   │
│         CSS: pointer-events: none       │
├─────────────────────────────────────────┤
│      Filament Canvas (WebGL2)           │
│    (PBR scene, shadows, post-process)   │
└─────────────────────────────────────────┘
```

**Why this works:**
- Filament continues to handle all opaque geometry, lighting, shadows
- WebGPU layer handles transparent particle effects (which are expensive in Filament)
- No context-sharing nightmares
- Easy to disable WebGPU layer on unsupported browsers (fallback to CPU particles)

**Performance considerations:**
- Two canvases means two compositor layers (GPU cost: minimal on modern browsers)
- Synchronization: WebGPU compute must finish before WebGPU render, but Filament is independent
- Camera matrices must be shared CPU-side each frame

---

## Prototype Implementation Plan

### Phase 1: Minimal WebGPU Compute (2-3 days)
1. Create `src/webgpu-compute.js` module
2. Implement a simple particle compute pipeline (spawn 1,000 particles, update via WGSL)
3. Render as colored points to an offscreen canvas
4. Overlay canvas on top of Filament with `position: absolute; pointer-events: none`
5. Add feature detection: `if (!navigator.gpu) fallbackToCPUParticles()`

### Phase 2: Procedural Textures (1-2 days)
1. Add WGSL FBM / Simplex noise compute shaders
2. Generate 512×512 textures for zone surfaces
3. Pass generated textures to Filament via `createImageBitmap` → `Filament.Texture` path

### Phase 3: Integration Polish (2-3 days)
1. Unify camera matrix sharing between Filament and WebGPU
2. Add depth-aware particle occlusion (sample Filament depth buffer if possible)
3. Performance telemetry: CPU timer queries vs. GPU timestamp queries

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Filament releases WebGPU backend, making dual-renderer obsolete | Medium | Low | Dual-renderer is thin; easy to migrate |
| WebGPU compute shaders slower than expected on low-end GPUs | Medium | Medium | Always maintain CPU fallback |
| Browser WebGPU bugs (especially Safari) | Low | High | Feature-detect and gracefully degrade |
| Context creation fails on systems with dual GPUs | Low | Medium | Retry with `powerPreference: 'low-power'` |
| Development time exceeds value | Low | High | Phase 1 is only 2-3 days; abort if blocked |

---

## Recommendation

**Proceed with Phase 1 prototype immediately.** The dual-renderer architecture is low-risk, the compute shader code is straightforward, and the fallback path ensures no user-facing regressions. If Phase 1 demonstrates a clear performance win, proceed to Phases 2 and 3.

**Do NOT wait for Filament's native WebGPU backend.** The timeline is uncertain, and the dual-renderer approach provides value today while remaining compatible with future Filament upgrades.
