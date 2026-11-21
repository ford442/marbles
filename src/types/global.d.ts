/// <reference types="vite/client" />

export {};

declare global {
    var __MARbles_TEST_API_URL__: string | undefined;
    var MARBLES_DISABLE_WASM_PHYSICS: boolean | undefined;

    interface Window {
        MARBLES_ENABLE_WASM_PHYSICS?: boolean;
        MARBLES_DISABLE_WASM_PHYSICS?: boolean;
        usingSimpleRenderer?: boolean;
        staticBatchStats?: unknown;
        game?: unknown;
        gameReady?: boolean;
        /** Plain-JSON result of the WebGPU boot probe (src/webgpu/boot-probe.js). */
        webgpuProbe?: unknown;
        webgpuParticlesReady?: boolean;
        /** DevTools handles published by the perf / quality / culling / LOD subsystems. */
        perfMonitor?: unknown;
        perfLevelSummary?: unknown;
        perfLevelLoads?: unknown;
        autoQualityGovernor?: unknown;
        cullingStats?: unknown;
        lodStats?: unknown;
        /** Renderer label (read by perf-monitor.js; falls back to `game.rendererType`). */
        rendererType?: string;
        updateLoadingProgress?: (pct: number, msg: string) => void;
        /** Set by `InitCore.init` once boot finished; `loadLevel` refuses to run before it. */
        __FILAMENT_FULLY_READY__?: boolean;
        /** Fades out the boot loading overlay (index.html); called after Filament's first frame. */
        hideLoadingScreen?: () => void;
    }
}
