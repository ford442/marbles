# WebGPU Boot Probe

This phase, WebGPU is required to boot Marbles 3D. This document covers the
boot probe module, what it changes about startup, and what is explicitly
*not* changing yet.

## Background

Marbles has a dual-renderer / WebGL history: Filament renders the whole game
on WebGL2, and a separate opt-in overlay (`?webgpuParticles=1`, gpu-chores
#407) adds WebGPU compute on top of it. Before this change, two different
places in the code each made their own `requestAdapter()` / `requestDevice()`
call (`src/webgpu/detect.js#isWebGPUAvailable` and
`src/webgpu/particle-backend.js#WebGPUParticleBackend.init()`), and a failed
WebGPU probe was never fatal — the game just quietly kept running without the
compute overlay. That silently falling back to "the marble still draws" hid
real WebGPU bugs, and let the two probes disagree with each other, and across
browsers (e.g. Chrome vs. Edge), without anyone noticing.

## What changed

- **One probe.** `src/webgpu/boot-probe.js` makes the session's single
  `requestAdapter()` / `requestDevice()` call, once, before Filament loads.
  Every other WebGPU consumer (`isWebGPUAvailable()`, the particle backend,
  gpu-chores) reuses its cached adapter/device instead of probing again.
- **Published result.** The probe's result — browser brand, adapter info
  (vendor/architecture/device/description where available), supported
  features, and any error — is written to `window.webgpuProbe` as plain JSON,
  so it can be compared across browsers or attached to a bug report.
- **Hard fail.** If the probe fails (`navigator.gpu` missing, no adapter, or
  `requestDevice()` rejects), `InitCore.init()` stops before Filament is ever
  loaded and shows a blocking fatal error on the loading screen
  (`InitCore._showWebGPURequiredError`). There is no WebGL renderer fallback
  for this failure, and no second probe attempt.
- **No URL-forced GL renderer.** The debug `SimpleDebugRenderer` (WebGL2)
  used to be selectable via `?renderer=simple`, `?webgl`, `?simpleRenderer`,
  or `?debugRenderer`. Those flags are unsupported this phase —
  `getRequestedRendererMode()` logs a warning and ignores them. The in-game
  renderer-mode panel's "Simple" toggle button was removed for the same
  reason (it would otherwise silently no-op).

## What did *not* change

- **Filament still renders on WebGL2.** The boot probe gates *startup*, not
  the rendering pipeline — Filament has no WebGPU backend here, and swapping
  it is out of scope for this phase. Non-goals: new WebGL materials/post,
  dual-live GPU contexts, netcode changes.
- **`installSimpleDebugBackend` / `SimpleDebugRenderer` still exist** as
  `InitCore`'s last-resort recovery path when Filament itself fails to load
  or fails to create an engine for reasons unrelated to WebGPU. That failure
  mode is pre-existing and out of scope here.

## Deferred: WebGL fallback

A later wave will reintroduce WebGL as an intentional, explicit fallback
(rather than a silent one) for browsers without WebGPU. Until then, a failed
probe is a hard stop.
