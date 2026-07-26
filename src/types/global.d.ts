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
        updateLoadingProgress?: (pct: number, msg: string) => void;
    }
}
