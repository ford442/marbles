// @ts-check
/**
 * WebGPU compute particle backend — overlays Filament WebGL2 (dual-renderer path).
 * Opt-in via ?webgpuParticles=1; CPU ParticleSystem remains the fallback.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import integrateShader from './shaders/particle-integrate.wgsl?raw';
import renderShader from './shaders/particle-render.wgsl?raw';
import { WEBGPU_PARTICLE_CAP, isWebGPUDepthTestRequested } from './detect.js';
import { getProbedDevice, recoverWebGPUDevice } from './boot-probe.js';
import { withValidationScope } from './error-scope.js';
import { buildViewProjection } from './camera-math.js';
import { packParticle, PARTICLE_STRIDE } from './particle-data.js';
import { updateParticleOcclusion } from './occlusion.js';
import { pruneToAliveIndices } from './alive-prune.js';
import {
    adoptDevice as adoptChoresDevice,
    getChoresBackend,
    releaseDevice as releaseChoresDevice,
    runJob,
} from '../gpu-chores/index.js';

export { packParticle, PARTICLE_STRIDE } from './particle-data.js';

/**
 * The slice of the game runtime this backend touches.
 * @typedef {object} ParticleBackendHost
 * @property {import('../particle-system.js').ParticleSystem} [particleSystem]
 * @property {import('@dimforge/rapier3d-compat').World} [world] Physics world used for occlusion raycasts.
 * @property {WebGPUParticleBackend | null} [webgpuParticles] The live overlay, if any.
 */

/**
 * Placeholder for fields that init() assigns before `ready` flips true. Yields
 * `undefined` at runtime; typed `never` so the field keeps its non-null GPU type.
 * @returns {never}
 */
const unassigned = () => /** @type {never} */ (/** @type {unknown} */ (undefined));

export class WebGPUParticleBackend {
    // Assigned in init(); every method that touches them is gated on
    // `this.ready`, which only flips true once init() has created them all.
    /** @type {GPUDevice | null} Borrowed from the boot probe; nulled on dispose. */
    device = null;
    /** @type {HTMLCanvasElement} */
    canvas = unassigned();
    /** @type {GPUCanvasContext} */
    context = unassigned();
    /** @type {GPUTextureFormat} */
    format = unassigned();
    /** @type {GPUBuffer} */
    particleBuffer = unassigned();
    /** @type {GPUBuffer} */
    activeBuffer = unassigned();
    /** @type {GPUBuffer} */
    readbackBuffer = unassigned();
    /** @type {GPUBuffer} */
    simParamsBuffer = unassigned();
    /** @type {GPUBuffer} */
    cameraBuffer = unassigned();
    /** @type {GPUBuffer} */
    occlusionBuffer = unassigned();
    /** @type {GPUComputePipeline} */
    computePipeline = unassigned();
    /** @type {GPURenderPipeline} */
    renderPipeline = unassigned();
    /** @type {GPUBindGroup} */
    computeBindGroup = unassigned();
    /** @type {GPUBindGroup} */
    renderBindGroup = unassigned();

    /**
     * @param {ParticleBackendHost} game
     * @param {import('../particle-system.js').ParticleSystem | null} particleSystem
     */
    constructor(game, particleSystem) {
        this.game = game;
        /** Cleared by `ParticleSystem` on teardown, hence nullable. */
        this.particleSystem = particleSystem;
        this.maxParticles = WEBGPU_PARTICLE_CAP;
        this.ready = false;
        this.stats = { activeCount: 0, backend: 'webgpu' };
        this._dirtyIndices = new Set();
        this._cpuScratch = new Float32Array(this.maxParticles * 16);
        this._depthTestEnabled = isWebGPUDepthTestRequested();
        this._occlusionScratch = new Float32Array(this.maxParticles).fill(1);
        this._readbackPending = false;
        this._prunePending = false;
        // Alive-slot compaction runs through gpu-chores; falls back to the
        // full-flag readback below if the job ever errors out.
        this._choresCompactEnabled = true;
        this._aliveMask = new Uint8Array(this.maxParticles);
        this._pendingDispose = false;
        this._resizePending = false;
        /** @type {(() => void) | null} */
        this._resizeHandler = null;
        /** @type {((info: GPUDeviceLostInfo) => void) | null} Set by tryInitWebGPUParticles. */
        this.onDeviceLost = null;
    }

    async init() {
        // The boot probe (boot-probe.js) already made the session's
        // requestAdapter()/requestDevice() call before Filament loaded. If it
        // failed, there is no device and the CPU ParticleSystem keeps running;
        // if it succeeded, this backend reuses that device.
        const device = getProbedDevice();
        this.device = device;
        if (!device) {
            console.warn('[WebGPU] no probed device available (boot probe did not run or failed)');
            return false;
        }

        const canvas = document.getElementById('webgpu-particles-canvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            console.warn('[WebGPU] overlay canvas #webgpu-particles-canvas not found');
            return false;
        }
        this.canvas = canvas;

        const context = canvas.getContext('webgpu');
        if (!context) {
            console.warn('[WebGPU] could not acquire webgpu context');
            return false;
        }
        this.context = context;

        this.format = navigator.gpu.getPreferredCanvasFormat();
        this._configureContext();
        this._resize();

        try {
            await withValidationScope(device, 'particle overlay resources', () => this._createResources(device));
        } catch (err) {
            console.warn('[WebGPU] particle overlay setup failed, staying on CPU particles:', err);
            this.dispose();
            return false;
        }

        // gpu-chores runs its generic jobs on this same device — one live GPU
        // API per session, no second requestDevice().
        adoptChoresDevice(device);

        device.lost.then((info) => {
            if (this.device !== device || !this.ready) return;
            console.warn(`[WebGPU] device lost: ${info.reason}`, info.message);
            this.dispose();
            this.onDeviceLost?.(info);
        });

        this._resizeHandler = () => this._scheduleResize();
        window.addEventListener('resize', this._resizeHandler);
        this.ready = true;
        window.webgpuParticlesReady = true;
        console.log(`[WebGPU] Particle backend ready (${this.maxParticles} slots)`);
        return true;
    }

    /**
     * Buffers, pipelines and bind groups. Runs inside one validation error
     * scope so a bad shader or layout rejects init instead of surfacing later
     * as an invalid dispatch.
     *
     * @param {GPUDevice} device
     */
    _createResources(device) {

        this.particleBuffer = device.createBuffer({
            size: this.maxParticles * PARTICLE_STRIDE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.activeBuffer = device.createBuffer({
            size: this.maxParticles * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.readbackBuffer = device.createBuffer({
            size: this.maxParticles * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        this.simParamsBuffer = device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraBuffer = device.createBuffer({
            size: 96,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Per-particle visibility against Filament scene geometry (see occlusion.js
        // for why this is a physics raycast rather than a shared GPU depth buffer).
        // Defaults to all-visible; only written to when ?webgpuDepthTest=1.
        this.occlusionBuffer = device.createBuffer({
            size: this.maxParticles * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.occlusionBuffer, 0, this._occlusionScratch);

        const computeModule = device.createShaderModule({ code: integrateShader });
        this.computePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: computeModule, entryPoint: 'main' },
        });

        const renderModule = device.createShaderModule({ code: renderShader });
        this.renderPipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: renderModule, entryPoint: 'vs_main' },
            fragment: {
                module: renderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                    },
                }],
            },
            primitive: { topology: 'triangle-list' },
        });

        this.computeBindGroup = device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.particleBuffer } },
                { binding: 1, resource: { buffer: this.simParamsBuffer } },
                { binding: 2, resource: { buffer: this.activeBuffer } },
            ],
        });

        this.renderBindGroup = device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.particleBuffer } },
                { binding: 1, resource: { buffer: this.cameraBuffer } },
                { binding: 2, resource: { buffer: this.occlusionBuffer } },
            ],
        });
    }

    /**
     * Configures the overlay swap chain once; resizing the canvas afterwards
     * needs no reconfigure (getCurrentTexture() follows the canvas size).
     *
     * The overlay is `premultiplied` so it composites over the Filament
     * canvas underneath. Filament's own canvas stays `alpha: false`
     * (rendering-defaults.js): it is the opaque bottom layer, and an alpha
     * backbuffer there would let the page background bleed through. Both
     * canvases present in sRGB, so particle colors match the scene.
     */
    _configureContext() {
        const device = this.device;
        if (!this.context || !device) return;
        this.context.configure({
            device,
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            alphaMode: 'premultiplied',
            colorSpace: 'srgb',
            // Clamp to SDR; 'extended' would let HDR particle colors exceed the
            // Filament layer they sit on.
            toneMapping: { mode: 'standard' },
        });
    }

    _resize() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor((this.canvas.clientWidth || window.innerWidth) * dpr));
        const h = Math.max(1, Math.floor((this.canvas.clientHeight || window.innerHeight) * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    _scheduleResize() {
        if (this._resizePending) return;
        this._resizePending = true;
        requestAnimationFrame(() => {
            this._resizePending = false;
            this._resize();
        });
    }

    /**
     * @param {number} index
     */
    markDirty(index) {
        if (index >= 0 && index < this.maxParticles) this._dirtyIndices.add(index);
    }

    uploadDirty() {
        const device = this.device;
        const particleSystem = this.particleSystem;
        if (!this.ready || !device || !particleSystem || this._dirtyIndices.size === 0) return;

        const pool = particleSystem.particles;
        const dirtyCount = this._dirtyIndices.size;
        const cap = Math.min(pool.length, this.maxParticles);

        // If most of the pool changed, a single bulk upload is cheaper than ranges.
        if (dirtyCount > cap * 0.5) {
            this.uploadAll();
            return;
        }

        const sorted = Array.from(this._dirtyIndices).sort((a, b) => a - b);
        let rangeStart = sorted[0];

        for (let i = 1; i <= sorted.length; i++) {
            const atEnd = i === sorted.length;
            const contiguous = !atEnd && sorted[i] === sorted[i - 1] + 1;

            if (contiguous) continue;

            const rangeEnd = sorted[i - 1];
            for (let j = rangeStart; j <= rangeEnd; j++) {
                const particle = pool[j];
                if (particle) {
                    packParticle(particle, j * PARTICLE_STRIDE, this._cpuScratch);
                }
            }

            const byteOffset = rangeStart * PARTICLE_STRIDE;
            const byteSize = (rangeEnd - rangeStart + 1) * PARTICLE_STRIDE;
            device.queue.writeBuffer(
                this.particleBuffer,
                byteOffset,
                this._cpuScratch.buffer,
                byteOffset,
                byteSize
            );

            if (!atEnd) rangeStart = sorted[i];
        }

        this._dirtyIndices.clear();
    }

    uploadAll() {
        const device = this.device;
        if (!this.ready || !device || !this.particleSystem) return;
        const pool = this.particleSystem.particles;
        for (let i = 0; i < Math.min(pool.length, this.maxParticles); i++) {
            const particle = pool[i];
            if (particle) packParticle(particle, i * PARTICLE_STRIDE, this._cpuScratch);
        }
        device.queue.writeBuffer(this.particleBuffer, 0, this._cpuScratch);
        this._dirtyIndices.clear();
    }

    /**
     * @param {number} deltaTime
     */
    step(deltaTime) {
        const device = this.device;
        if (!this.ready || !device) return;
        this.uploadDirty();

        const simParams = new ArrayBuffer(32);
        const simView = new DataView(simParams);
        simView.setFloat32(0, deltaTime, true);
        simView.setUint32(4, this.maxParticles, true);
        simView.setFloat32(8, 0, true);
        simView.setFloat32(12, -9.81, true);
        simView.setFloat32(16, 0, true);
        device.queue.writeBuffer(this.simParamsBuffer, 0, simParams);

        const useChores = this._choresCompactAvailable();

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.computePipeline);
        pass.setBindGroup(0, this.computeBindGroup);
        pass.dispatchWorkgroups(Math.ceil(this.maxParticles / 256));
        pass.end();

        if (!useChores) {
            // Legacy path: pull every alive flag back and scan it on the CPU.
            encoder.copyBufferToBuffer(
                this.activeBuffer, 0, this.readbackBuffer, 0, this.readbackBuffer.size
            );
        }
        device.queue.submit([encoder.finish()]);

        if (useChores) {
            this._schedulePrune();
        } else {
            this._scheduleReadback();
        }
    }

    /**
     * Whether the alive-slot compaction can go through gpu-chores this frame.
     * Requires the chores device (ours) and the `?no_gpu_compute` kill switch off.
     *
     * @returns {boolean}
     */
    _choresCompactAvailable() {
        return this._choresCompactEnabled && getChoresBackend() === 'webgpu';
    }

    /**
     * Compacts the alive-flag buffer on the GPU via gpu-chores and prunes the
     * CPU-side active list from the resulting index list. Only the survivor
     * count and that index list cross the bus — not all `maxParticles` flags.
     */
    _schedulePrune() {
        if (this._prunePending) return;
        this._prunePending = true;

        runJob({
            op: 'compact_f32',
            prefer: 'auto',
            data: this.activeBuffer,
            count: this.maxParticles,
            threshold: 0.5,
        })
            .then(({ indices, count }) => {
                this._prunePending = false;
                if (!this.ready || !this.particleSystem) {
                    if (this._pendingDispose) this._destroyResources();
                    return;
                }
                this._pruneToAliveIndices(indices, count);
                if (this._pendingDispose) this._destroyResources();
            })
            .catch((err) => {
                this._prunePending = false;
                // One failure is enough: drop back to the flag readback for good.
                this._choresCompactEnabled = false;
                console.warn('[WebGPU] chores compact failed, using flag readback:', err);
                if (this._pendingDispose) this._destroyResources();
            });
    }

    /**
     * @param {Uint32Array | null} indices Ascending alive pool slots.
     * @param {number} count
     */
    _pruneToAliveIndices(indices, count) {
        if (!this.particleSystem) return;
        this.stats.activeCount = pruneToAliveIndices(
            indices,
            count,
            this.particleSystem.activeParticles,
            this._aliveMask
        );
    }

    _scheduleReadback() {
        if (this._readbackPending) return;
        this._readbackPending = true;

        this.readbackBuffer.mapAsync(GPUMapMode.READ)
            .then(() => {
                this._readbackPending = false;
                if (!this.ready || !this.particleSystem) {
                    try { this.readbackBuffer.unmap(); } catch {}
                    if (this._pendingDispose) this._destroyResources();
                    return;
                }

                const flags = new Float32Array(this.readbackBuffer.getMappedRange());
                const active = this.particleSystem.activeParticles;
                for (let i = active.length - 1; i >= 0; i--) {
                    const p = active[i];
                    if (!p || (flags[p._poolIndex] ?? 1) < 0.5) {
                        if (p) p.active = false;
                        active.splice(i, 1);
                    }
                }
                this.stats.activeCount = active.length;
                this.readbackBuffer.unmap();

                if (this._pendingDispose) this._destroyResources();
            })
            .catch((err) => {
                this._readbackPending = false;
                console.warn('[WebGPU] active-flag readback failed:', err);
                if (this._pendingDispose) this._destroyResources();
            });
    }

    /**
     * Recomputes per-particle scene occlusion via physics raycast (opt-in, see occlusion.js).
     * No-op when ?webgpuDepthTest=1 wasn't requested — the occlusion buffer stays all-visible.
     * @param {{ eye: number[] } | null} cameraState
     */
    updateOcclusion(cameraState) {
        const device = this.device;
        if (!this.ready || !device || !this._depthTestEnabled || !this.particleSystem) return;
        const world = this.game.world;
        const eye = cameraState?.eye;
        if (!world || !eye) return;

        updateParticleOcclusion(
            (ox, oy, oz, dx, dy, dz, maxToi) => {
                const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
                const hit = world.castRay(ray, maxToi, true);
                return !!hit && !hit.collider.isSensor();
            },
            eye,
            this.particleSystem.activeParticles,
            this._occlusionScratch
        );
        device.queue.writeBuffer(this.occlusionBuffer, 0, this._occlusionScratch);
    }

    /**
     * @param {{ eye: number[], target: number[] } | null} cameraState
     * @param {number} fovDeg
     * @param {number} aspect
     */
    render(cameraState, fovDeg, aspect) {
        const device = this.device;
        if (!this.ready || !device || !cameraState) return;

        this.updateOcclusion(cameraState);
        this._resize();
        const viewProj = buildViewProjection(cameraState, fovDeg, aspect);
        const camData = new ArrayBuffer(96);
        new Float32Array(camData, 0, 16).set(viewProj);
        const camView = new DataView(camData);
        const [eyeX = 0, eyeY = 0, eyeZ = 0] = cameraState.eye;
        camView.setFloat32(64, eyeX, true);
        camView.setFloat32(68, eyeY, true);
        camView.setFloat32(72, eyeZ, true);
        camView.setFloat32(80, this.canvas.width, true);
        camView.setFloat32(84, this.canvas.height, true);
        device.queue.writeBuffer(this.cameraBuffer, 0, camData);

        const encoder = device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
        pass.setPipeline(this.renderPipeline);
        pass.setBindGroup(0, this.renderBindGroup);
        pass.draw(6, this.maxParticles);
        pass.end();
        device.queue.submit([encoder.finish()]);

        this.canvas.style.opacity = this.stats.activeCount > 0 ? '1' : '0';
    }

    dispose() {
        this.ready = false;
        window.webgpuParticlesReady = false;

        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }

        if (this.canvas) this.canvas.style.opacity = '0';

        if (this._readbackPending || this._prunePending) {
            this._pendingDispose = true;
            return;
        }

        this._destroyResources();
    }

    _destroyResources() {
        // Only let go of chores if they still hold *this* device — after a
        // recovery they may already have adopted the replacement.
        if (this.device) releaseChoresDevice(this.device);
        try { this.context?.unconfigure(); } catch {}
        try { this.particleBuffer?.destroy(); } catch {}
        try { this.activeBuffer?.destroy(); } catch {}
        try { this.readbackBuffer?.destroy(); } catch {}
        try { this.simParamsBuffer?.destroy(); } catch {}
        try { this.cameraBuffer?.destroy(); } catch {}
        try { this.occlusionBuffer?.destroy(); } catch {}
        // The device itself is the session's shared boot-probed device (see
        // boot-probe.js) — this backend borrows it and must not destroy it.
        this.device = null;
    }
}

/**
 * Non-blocking init — does not delay Filament / game boot.
 * @param {ParticleBackendHost} game
 */
export async function tryInitWebGPUParticles(game) {
    if (!game?.particleSystem) return null;
    const backend = new WebGPUParticleBackend(game, game.particleSystem);
    const ok = await backend.init();
    if (!ok) return null;
    backend.onDeviceLost = () => { void recoverWebGPUParticles(game, backend); };
    game.particleSystem.enableWebGPU(backend);
    game.webgpuParticles = backend;
    return backend;
}

/**
 * After a device loss: take the boot probe's one recovery and rebuild the
 * overlay on the new device, or drop the overlay for good and leave the CPU
 * ParticleSystem running. Either way the session never keeps a dead overlay.
 *
 * @param {ParticleBackendHost} game
 * @param {WebGPUParticleBackend} lostBackend
 */
async function recoverWebGPUParticles(game, lostBackend) {
    const particleSystem = game.particleSystem;
    particleSystem?.disableWebGPU(lostBackend);
    if (game.webgpuParticles === lostBackend) game.webgpuParticles = null;

    const { ok, error } = await recoverWebGPUDevice();
    if (!ok) {
        console.info(`[WebGPU] overlay disabled after device loss (${error}); CPU particles continue`);
        return;
    }
    if (!game.particleSystem || game.particleSystem !== particleSystem) return;
    const next = await tryInitWebGPUParticles(game);
    console.info(next
        ? '[WebGPU] particle overlay recovered on a new device'
        : '[WebGPU] overlay could not be rebuilt after device loss; CPU particles continue');
}
