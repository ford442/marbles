# WebGPU Particle Compute (Experimental)

Filament remains the **primary WebGL2 renderer** for scene geometry, lighting, and post-processing. WebGPU is used only for an optional **compute + overlay render** path for high-count particles.

## Enable

```
http://localhost:5173/?webgpuParticles=1
```

Optional procedural noise texture (for future marble material experiments):

```
?webgpuParticles=1&webgpuNoise=1
```

Stress / benchmark burst (emits ~8000 sparks at level start):

```
?webgpuParticles=1&webgpuStress=1
```

## Requirements

- Chrome 113+, Edge 113+, Firefox 110+, or Safari 18+ with WebGPU enabled
- If WebGPU is unavailable, init fails, or the device is lost, the game **falls back to the CPU `ParticleSystem`** with no blocking or errors

## Architecture

```
┌─────────────────────────────────────┐
│  HUD / UI (DOM)                     │
├─────────────────────────────────────┤
│  #webgpu-particles-canvas (WebGPU)  │  ← billboards, alpha blend
├─────────────────────────────────────┤
│  #canvas (Filament WebGL2)          │  ← scene, shadows, PBR
└─────────────────────────────────────┘
```

| Module | Role |
|--------|------|
| `src/webgpu/detect.js` | Feature flag + adapter probe |
| `src/webgpu/particle-backend.js` | WGSL integrate + billboard render |
| `src/webgpu/shaders/particle-integrate.wgsl` | Compute pass: gravity, drag, lifetime, active flag |
| `src/webgpu/shaders/particle-render.wgsl` | Billboard vertex/fragment overlay shader |
| `src/webgpu/noise-texture.js` | Optional 256² FBM noise via compute |
| `src/particle-system.js` | CPU fallback; delegates sim when GPU ready |

Particle cap with WebGPU: **8192** slots (target 5k–10k at 60 FPS on mid desktop).

### CPU/GPU consistency

The compute shader writes an `activeFlags` buffer each frame. The backend reads it back asynchronously and reconciles `particleSystem.activeParticles`, so:

- CPU-side stats and pool reuse stay accurate while the GPU simulates.
- If the WebGPU device is lost or the backend is disabled, the game falls back to the CPU `ParticleSystem` without a burst of zombie particles.

### Upload optimization

Dirty particles are uploaded as coalesced contiguous ranges instead of one `writeBuffer` per particle. If more than half the pool is dirty, the backend falls back to a single bulk upload.

## wasm_renderer / C++ Dawn

The incomplete C++ Dawn experiment lives at **`docs/backups/experimental-wasm-renderer/`** (archived July 2026). It is **not** part of the game runtime. Use the native JS WebGPU path above instead.

See also: `docs/backups/unused-game-modules/misc/webgpu-evaluation.md` for the original dual-renderer evaluation.

## Manual test plan

1. `npm run dev`
2. Open `?webgpuParticles=1&webgpuStress=1`
3. Load a level with ambient particles (e.g. **Lava Tubes** via `?devLevels=1`) or any level after stress burst
4. Confirm console: `[WebGPU] Particle backend ready (8192 slots)`
5. Open FPS overlay (`?perf=1`, press F2) — aim for ~60 FPS with thousands of visible particles
6. Remove `webgpuParticles` — game should behave as before (CPU path)

## Does not block boot

WebGPU init runs **after** Filament and `ParticleSystem` are created. Failure only logs a warning and keeps CPU simulation.
