export const SNAP_STORAGE_KEY = 'marbles3d_editor_snap';

/** @typedef {{ enabled: boolean, gridSize: number, rotationDeg: 0 | 15 | 45 }} SnapSettings */

/** @returns {SnapSettings} */
export function defaultSnapSettings() {
    return { enabled: true, gridSize: 1, rotationDeg: 15 };
}

/**
 * @returns {SnapSettings}
 */
export function loadSnapSettings() {
    if (typeof localStorage === 'undefined') return defaultSnapSettings();
    try {
        const raw = localStorage.getItem(SNAP_STORAGE_KEY);
        if (!raw) return defaultSnapSettings();
        const parsed = JSON.parse(raw);
        return {
            enabled: parsed.enabled !== false,
            gridSize: [0.5, 1, 2].includes(parsed.gridSize) ? parsed.gridSize : 1,
            rotationDeg: [0, 15, 45].includes(parsed.rotationDeg) ? parsed.rotationDeg : 15,
        };
    } catch {
        return defaultSnapSettings();
    }
}

/**
 * @param {SnapSettings} settings
 */
export function saveSnapSettings(settings) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SNAP_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * @param {number} value
 * @param {number} gridSize
 * @param {boolean} enabled
 */
export function snapScalar(value, gridSize, enabled) {
    if (!enabled || gridSize <= 0) return value;
    return Math.round(value / gridSize) * gridSize;
}

/**
 * @param {{ x: number, y: number, z: number }} pos
 * @param {number} gridSize
 * @param {boolean} enabled
 */
export function snapPosition(pos, gridSize, enabled) {
    return {
        x: snapScalar(pos.x, gridSize, enabled),
        y: snapScalar(pos.y, gridSize, enabled),
        z: snapScalar(pos.z, gridSize, enabled),
    };
}

/**
 * @param {number} rad
 * @param {0 | 15 | 45} rotationDeg
 * @param {boolean} enabled
 */
export function snapRotation(rad, rotationDeg, enabled) {
    if (!enabled || !rotationDeg) return rad;
    const step = (rotationDeg * Math.PI) / 180;
    return Math.round(rad / step) * step;
}

/**
 * @param {0 | 15 | 45} rotationDeg
 */
export function rotationStepRad(rotationDeg) {
    if (!rotationDeg) return Math.PI / 12;
    return (rotationDeg * Math.PI) / 180;
}
