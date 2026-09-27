import { quaternionToMat4, type Mat4, type Quat, type Vec3 } from '../math.ts';
import type { FilamentHandle, FilamentModule } from '../types/filament.ts';

export const DOF_CAMERA_MODES = new Set(['cinematic', 'follow', 'action'])
export const DOF_UPDATE_THRESHOLD = 1.0
const CORE_TRANSFORM_POS_EPS_SQ = 0.000001
const CORE_TRANSFORM_ROT_EPS_SQ = 0.000001
const CORE_COLOR_EPS = 1 / 255

/** Per-object cache slots used by the transform-sync helpers. */
export interface TransformSyncOwner {
    _transformEntity?: unknown
    _transformInst?: unknown
    _forceTransformSync?: boolean
    _lastTransformSync?: {
        x: number; y: number; z: number
        rx: number; ry: number; rz: number; rw: number
        scaleKey: number
    }
}

/** Per-object cache slots used by `setColor3IfChanged`. */
export interface ColorSyncOwner {
    _lastBaseColor?: number[]
    _lastBaseColorAt?: number
}

export function getCachedTransformInstance(
    tcm: FilamentHandle,
    owner: TransformSyncOwner,
    entity: unknown,
): FilamentHandle {
    if (owner._transformEntity !== entity || owner._transformInst === undefined) {
        owner._transformEntity = entity
        owner._transformInst = tcm.getInstance(entity)
    }
    return owner._transformInst
}

export function transformChanged(owner: TransformSyncOwner, t: Vec3, r: Quat, scaleKey = 1): boolean {
    if (owner._forceTransformSync) {
        owner._forceTransformSync = false
        return true
    }

    const last = owner._lastTransformSync
    if (last &&
        last.scaleKey === scaleKey &&
        ((t.x - last.x) * (t.x - last.x) + (t.y - last.y) * (t.y - last.y) + (t.z - last.z) * (t.z - last.z)) < CORE_TRANSFORM_POS_EPS_SQ &&
        ((r.x - last.rx) * (r.x - last.rx) + (r.y - last.ry) * (r.y - last.ry) + (r.z - last.rz) * (r.z - last.rz) + (r.w - last.rw) * (r.w - last.rw)) < CORE_TRANSFORM_ROT_EPS_SQ) {
        return false
    }

    owner._lastTransformSync = { x: t.x, y: t.y, z: t.z, rx: r.x, ry: r.y, rz: r.z, rw: r.w, scaleKey }
    return true
}

/** Scale the three basis columns of a column-major 4x4 in place (translation untouched). */
function scaleBasisColumn(mat: Mat4, firstIndex: number, factor: number): void {
    for (let i = firstIndex; i < firstIndex + 3; i++) mat[i] = (mat[i] as number) * factor
}

/**
 * Build a transform with per-axis scale. Note `quaternionToMat4` writes into a
 * shared pooled matrix, so consume the result before the next call.
 */
export function scaledTransform(t: Vec3, q: Quat, scale: Vec3): Mat4 {
    const mat = quaternionToMat4(t, q)
    scaleBasisColumn(mat, 0, scale.x)
    scaleBasisColumn(mat, 4, scale.y)
    scaleBasisColumn(mat, 8, scale.z)
    return mat
}

export function setColor3IfChanged(
    game: { Filament: FilamentModule },
    owner: ColorSyncOwner,
    matInstance: FilamentHandle,
    color: ArrayLike<number>,
    now: number,
    minIntervalMs = 50,
): boolean {
    if (!matInstance) return false
    const last = owner._lastBaseColor
    const lastAt = owner._lastBaseColorAt || 0
    if (last && (now - lastAt) < minIntervalMs) return false
    const r = color[0] as number, g = color[1] as number, b = color[2] as number
    if (last &&
        Math.abs(r - (last[0] as number)) < CORE_COLOR_EPS &&
        Math.abs(g - (last[1] as number)) < CORE_COLOR_EPS &&
        Math.abs(b - (last[2] as number)) < CORE_COLOR_EPS) {
        owner._lastBaseColorAt = now
        return false
    }
    owner._lastBaseColor = [r, g, b]
    owner._lastBaseColorAt = now
    matInstance.setColor3Parameter('baseColor', game.Filament.RgbType.sRGB, color)
    return true
}
