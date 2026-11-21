import type { MapVec3 } from '../types/map.ts';

export const SNAP_STORAGE_KEY = 'marbles3d_editor_snap';

export type SnapRotationDeg = 0 | 15 | 45;

export interface SnapSettings {
    enabled: boolean;
    gridSize: number;
    rotationDeg: SnapRotationDeg;
}

const GRID_SIZES: readonly unknown[] = [0.5, 1, 2];
const ROTATION_STEPS: readonly SnapRotationDeg[] = [0, 15, 45];

export function isSnapRotationDeg(v: unknown): v is SnapRotationDeg {
    return ROTATION_STEPS.some((step) => step === v);
}

export function defaultSnapSettings(): SnapSettings {
    return { enabled: true, gridSize: 1, rotationDeg: 15 };
}

export function loadSnapSettings(): SnapSettings {
    if (typeof localStorage === 'undefined') return defaultSnapSettings();
    try {
        const raw = localStorage.getItem(SNAP_STORAGE_KEY);
        if (!raw) return defaultSnapSettings();
        const parsed: unknown = JSON.parse(raw);
        // Same as reading props off the parsed value (throws → defaults for null).
        const { enabled, gridSize, rotationDeg } = parsed as Partial<Record<keyof SnapSettings, unknown>>;
        return {
            enabled: enabled !== false,
            gridSize: typeof gridSize === 'number' && GRID_SIZES.includes(gridSize) ? gridSize : 1,
            rotationDeg: isSnapRotationDeg(rotationDeg) ? rotationDeg : 15,
        };
    } catch {
        return defaultSnapSettings();
    }
}

export function saveSnapSettings(settings: SnapSettings): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SNAP_STORAGE_KEY, JSON.stringify(settings));
}

export function snapScalar(value: number, gridSize: number, enabled: boolean): number {
    if (!enabled || gridSize <= 0) return value;
    return Math.round(value / gridSize) * gridSize;
}

export function snapPosition(pos: MapVec3, gridSize: number, enabled: boolean): MapVec3 {
    return {
        x: snapScalar(pos.x, gridSize, enabled),
        y: snapScalar(pos.y, gridSize, enabled),
        z: snapScalar(pos.z, gridSize, enabled),
    };
}

export function snapRotation(rad: number, rotationDeg: SnapRotationDeg, enabled: boolean): number {
    if (!enabled || !rotationDeg) return rad;
    const step = (rotationDeg * Math.PI) / 180;
    return Math.round(rad / step) * step;
}

export function rotationStepRad(rotationDeg: SnapRotationDeg): number {
    if (!rotationDeg) return Math.PI / 12;
    return (rotationDeg * Math.PI) / 180;
}
