/**
 * Filament boundary aliases. The runtime is loaded via UMD and we don't consume
 * its bundled typings, so engine/material/entity handles stay `any` here on
 * purpose (same convention as `material-system.ts`). Use these names instead of
 * bare `any` so the boundary is greppable and can be tightened in one place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilamentModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilamentHandle = any;
