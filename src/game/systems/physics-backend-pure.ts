/** Type re-exports for `tsc` — implementation in `physics-backend-pure.js`. */
export * from './physics-backend-pure.js';

export interface PhysicsWorkerOptions {
    search?: string;
    crossOriginIsolated?: boolean;
    hasSharedArrayBuffer?: boolean;
    multiplayerMode?: boolean;
    hostAuthorityMode?: boolean;
    editorMode?: boolean;
    levelId?: string | null;
}
