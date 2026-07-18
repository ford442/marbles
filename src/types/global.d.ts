export {};

declare global {
    interface Window {
        MARBLES_ENABLE_WASM_PHYSICS?: boolean;
        usingSimpleRenderer?: boolean;
        staticBatchStats?: unknown;
        game?: unknown;
        gameReady?: boolean;
        updateLoadingProgress?: (pct: number, msg: string) => void;
    }
}
