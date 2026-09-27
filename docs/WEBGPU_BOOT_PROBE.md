# WebGPU Boot Probe

Marbles 3D renders with Filament on **WebGL2**. WebGPU drives only the compute
overlay (the opt-in `?webgpuParticles=1` particle backend and gpu-chores). This
document covers the boot probe that creates the session's one `GPUDevice`, what
that device is asked for, and what happens when WebGPU is missing or the device
is lost.

## Background

Before the probe, two places each made their own `requestAdapter()` /
`requestDevice()` call (`src/webgpu/detect.js#isWebGPUAvailable` and
`WebGPUParticleBackend.init()`), and they could disagree with each other and
across browsers without anyone noticing. #408 fixed that with a single probe and
briefly made a failed probe a hard stop. Since Filament never needed WebGPU,
that blocked browsers that could run the real renderer, so the hard stop was
replaced by the intentional, recorded fallback described below.

## The probe

`src/webgpu/boot-probe.js` makes the session's `requestAdapter()` /
`requestDevice()` call once, from `InitCore.init()`, before Filament loads.
Every other WebGPU consumer (`isWebGPUAvailable()`, the particle backend,
gpu-chores) reuses its cached adapter and device.

- **Power preference.** `InitCore` resolves the Filament WebGL options first
  and passes their `powerPreference` to the probe
  (`toWebGPUPowerPreference()` in `src/rendering-defaults.js`). Both APIs on
  the page ask for the same GPU: `low-power` on `low` quality (the mobile
  default), `high-performance` on medium and above. `?glPowerPreference=`
  overrides both. `default` means no preference.
- **Device descriptor.** `buildDeviceDescriptor()`
  (`src/webgpu/device-requirements.js`) builds the `requestDevice()` call:
  - `label: 'marbles-boot'`, plus a labelled default queue.
  - `requiredFeatures` is the adapter's features intersected with the ones we
    can use: `timestamp-query`, `shader-f16`, `subgroups`,
    `dual-source-blending`. All are optional. `bgra8unorm-storage` is not
    requested because nothing writes storage into the swap-chain format.
  - `requiredLimits` come from the working set (8192 particles ×
    64-byte stride = 512 KiB largest buffer, 4 storage buffers per stage for
    `compact_f32`, 256-wide integrate workgroups), not from the adapter
    maximum. If an adapter reports less, the limit is clamped and the
    shortfall is logged in `limitShortfalls`.
- **Published result.** `window.webgpuProbe` is plain JSON containing the
  browser brand, power preference, adapter info, adapter `features`, the
  `requiredFeatures` / `requiredLimits` that were requested, `error`,
  `lastError` (from `uncapturederror`), `deviceLost`, and `recovered`.

## When the probe fails

This covers a missing `navigator.gpu`, no adapter, or a rejected
`requestDevice()`.

- Boot continues. Filament renders on WebGL2 as usual.
- `window.webgpuProbe.ok === false`, and `window.rendererFallbackReason`
  records why (for example `WebGPU unavailable (navigator.gpu is unavailable in
  this browser); WebGL2 only, GPU compute on CPU`).
- The particle overlay does not start and the CPU `ParticleSystem` simulates.
  gpu-chores have no adopted device, so every job runs on the CPU.

## Device loss

- The probe listens to `device.lost`, drops the cached device, and records
  `deviceLost: { reason, message }`.
- The particle backend disposes itself and calls `recoverWebGPUDevice()`.
  That function requests a fresh adapter and device **once per session**, and
  concurrent callers share the same attempt. On success the overlay is rebuilt
  on the new device and gpu-chores adopt it. If the recovery fails, is already
  spent, or the loss was an intentional `destroy()`, the overlay stays off,
  `ParticleSystem.disableWebGPU()` retires the GPU-simulated particles, and
  the CPU path continues. A dead overlay is never left attached.
- A stale owner can't release a replacement device from gpu-chores:
  `releaseDevice(device)` only lets go if chores still hold that exact device.

## Validation errors

- `device.addEventListener('uncapturederror')` writes the message to
  `window.webgpuProbe.lastError`.
- Pipeline creation runs inside a `validation` error scope
  (`withValidationScope()` in `src/webgpu/error-scope.js`). This covers the
  particle overlay's resources, the gpu-chores pipelines, and the noise
  kernel. A bad shader or layout then rejects: the overlay stays on CPU, and a
  chores job falls back to the CPU via `runJob`. Without the scope it would
  surface later as an invalid dispatch.

## Renderer selection

The player default is always Filament. `?renderer=simple` (and `?webgl`,
`?simpleRenderer`, `?debugRenderer`) selects the WebGL2 debug renderer for
dev/e2e work only. See [RENDERER_FALLBACK.md](RENDERER_FALLBACK.md).

## Later

Filament's upstream WebGPU backend is not in the npm `filament` we pin
(`^1.51.5`, WebGL2). Once it ships there, evaluate moving Filament onto the
probed device so each session uses a single GPU API. Do not revive
`docs/backups/experimental-wasm-renderer/`.
