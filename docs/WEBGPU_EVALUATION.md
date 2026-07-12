# WebGPU Compute Evaluation for Marbles 3D

> **Status:** Phase 1 prototype implemented — see [WEBGPU_PARTICLES.md](../WEBGPU_PARTICLES.md) for usage (`?webgpuParticles=1`).

This document is the original evaluation. The shipped approach matches the **dual-renderer** recommendation below: Filament WebGL2 for the scene, WebGPU for optional particle compute + overlay.

---

## Executive Summary

WebGPU offers significant potential for the Marbles 3D project, primarily through **compute shaders** for particle simulation, procedural texture generation, and GPU-driven culling. However, **Filament does not yet have a stable WebGPU backend** (as of Filament 1.51.5), which creates architectural friction.

**Verdict:** Adopt a **dual-renderer research track** — keep the proven Filament WebGL2 pipeline for rendering, but prototype WebGPU compute passes for physics particles and procedural generation using a separate canvas/context that composites over Filament's output.

---

## Implementation (July 2026)

| Component | Path |
|-----------|------|
| Feature detect + flags | `src/webgpu/detect.js` |
| Particle compute + render | `src/webgpu/particle-backend.js` |
| WGSL shaders | `src/webgpu/shaders/` |
| Noise texture (optional) | `src/webgpu/noise-texture.js` |
| CPU fallback | `src/particle-system.js` |

**wasm_renderer:** Archived at `docs/backups/experimental-wasm-renderer/` — not integrated.

---

_Full evaluation content preserved in [docs/backups/unused-game-modules/misc/webgpu-evaluation.md](../backups/unused-game-modules/misc/webgpu-evaluation.md)._
