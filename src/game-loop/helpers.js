import { quaternionToMat4 } from '../math.js';

export const DOF_CAMERA_MODES = new Set(['cinematic', 'follow', 'action'])
export const DOF_UPDATE_THRESHOLD = 1.0
const CORE_TRANSFORM_POS_EPS_SQ = 0.000001
const CORE_TRANSFORM_ROT_EPS_SQ = 0.000001
const CORE_COLOR_EPS = 1 / 255

export function getCachedTransformInstance(tcm, owner, entity) {
    if (owner._transformEntity !== entity || owner._transformInst === undefined) {
        owner._transformEntity = entity
        owner._transformInst = tcm.getInstance(entity)
    }
    return owner._transformInst
}

export function transformChanged(owner, t, r, scaleKey = 1) {
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

export function scaledTransform(t, q, scale) {
    const mat = quaternionToMat4(t, q)
    mat[0] *= scale.x; mat[1] *= scale.x; mat[2] *= scale.x
    mat[4] *= scale.y; mat[5] *= scale.y; mat[6] *= scale.y
    mat[8] *= scale.z; mat[9] *= scale.z; mat[10] *= scale.z
    return mat
}

export function setColor3IfChanged(game, owner, matInstance, color, now, minIntervalMs = 50) {
    if (!matInstance) return false
    const last = owner._lastBaseColor
    const lastAt = owner._lastBaseColorAt || 0
    if (last && (now - lastAt) < minIntervalMs) return false
    if (last &&
        Math.abs(color[0] - last[0]) < CORE_COLOR_EPS &&
        Math.abs(color[1] - last[1]) < CORE_COLOR_EPS &&
        Math.abs(color[2] - last[2]) < CORE_COLOR_EPS) {
        owner._lastBaseColorAt = now
        return false
    }
    owner._lastBaseColor = [color[0], color[1], color[2]]
    owner._lastBaseColorAt = now
    matInstance.setColor3Parameter('baseColor', game.Filament.RgbType.sRGB, color)
    return true
}
