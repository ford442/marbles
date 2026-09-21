# gpu-chores (Tier B)

Reusable GPU job helpers shared across the rollout (Tier A: Chromashift #132,
clip_stacker #246, image_video_effects #1106, flac_player #201, mod-player #395,
web_sequencer #1105). Marbles is Tier B.

## Chores vs. domain compute

The split matters, and it is the reason this module exists alongside the WebGPU
particle work in `docs/WEBGPU_PARTICLES.md` / `docs/WEBGPU_EVALUATION.md`:

| Stays marbles-owned (domain)                        | Moves to chores (generic)               |
|-----------------------------------------------------|-----------------------------------------|
| `src/webgpu/shaders/particle-integrate.wgsl`         | `reduce_f32` over a float buffer        |
| `src/webgpu/noise-texture.js` (noise kernel)         | `compact_f32` (prefix-sum compaction)   |
| Rapier marble physics authority, spatial hash        | `batched_distance` (broadphase assist)  |

Chores are "scan this buffer / compact the survivors / reduce it" — the part
that looks identical in every app. Nothing about marble simulation lives here.

## Job API

Same shape as Chromashift #132:

```javascript
import { runJob } from './gpu-chores/index.js';

const { indices, count, backend } = await runJob({
    op: 'compact_f32',
    prefer: 'auto',      // 'auto' | 'gpu' | 'cpu'
    data: aliveFlags,    // Float32Array, or a resident GPUBuffer
    count: 8192,
    threshold: 0.5,
});
```

| Op | Inputs | Result |
|---|---|---|
| `reduce_f32` | `{ data, count?, reduce: 'sum' \| 'min' \| 'max' }` | `{ value, backend }` |
| `compact_f32` | `{ data, count?, threshold?, readIndices? }` | `{ indices, count, gpuBuffer, backend }` |
| `batched_distance` | `{ points, origin, squared? }` | `{ distances, backend }` |

`data` may be a `Float32Array` or a `GPUBuffer` that is already resident. When
it is resident nothing is uploaded, and with `readIndices: false` only the
survivor count crosses the bus — the index list stays on the GPU for a renderer
that can consume it directly.

All kernels are 1-D `@workgroup_size(64)`.

## Device adoption

Chores never call `requestAdapter()` or `requestDevice()`. The particle backend
hands its device over in `WebGPUParticleBackend.init()`:

```javascript
adoptChoresDevice(this.device);
```

and `releaseDevice()` drops it on teardown *without* destroying it — the device
belongs to whoever created it. One live GPU API per session.

## Backend order

WebGPU → WASM/JS. WebGL2 is deliberately not a chores backend: Filament already
holds the WebGL2 context, and a second live GPU API on the same working set is
the dual-hot driver/VRAM risk this rollout is avoiding. A WebGL-only session
simply never hands a device over, so chores run on the CPU there.

The CPU path routes `batched_distance` through the MarblePhysics WASM bridge
when the native module is live (`src/wasm-bridge.js`); its JS fallback is the
same arithmetic, so results do not drift between backends.

## Kill switch and breadcrumbs

- `?no_gpu_compute` (or `?noGpuCompute`, or `window.MARBLES_DISABLE_GPU_COMPUTE
  = true`) forces every job onto the CPU. `?no_gpu_compute=0` opts back in.
- `window.gpuChoresBreadcrumbs` holds the last 64 events: `device-adopted`,
  `device-lost`, `webgpu-backend-ready`, `gpu-unavailable`, `gpu-job-failed`,
  `webgpu-backend-disposed`.
- `getChoresStats()` returns `{ backend, gpuJobs, cpuJobs, gpuFallbacks }`.

A GPU job that throws is retried on the CPU when its input is host-side, and
logs a `gpu-job-failed` breadcrumb either way. Resident-`GPUBuffer` jobs have no
CPU fallback by construction, so those rejections propagate to the caller.

## Where it is wired in

`WebGPUParticleBackend` previously read all `maxParticles` alive flags back
every frame and scanned them on the CPU. It now runs `compact_f32` over the
alive-flag buffer in place and prunes the active list from the survivor index
list (`src/webgpu/alive-prune.js`). One `gpu-job-failed` is enough to drop the
backend to the legacy flag readback for the rest of the session.

`CullingManager` is intentionally untouched: `isVisible()` is a synchronous
per-entity call and chores jobs are async, so batching it would mean reshaping
the culling frame. `batched_distance` is available for that work when someone
takes it on.

## Parity testing

`tests/test_gpu_chores.js` runs on CI without a GPU. It pins the CPU goldens and
re-implements the compact and reduce kernels' block decomposition in JS, so a
parity break localises to a pass rather than to "the GPU". Compaction parity is
exact; summation regroups across blocks and is checked to float tolerance.
