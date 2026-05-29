/**
 * post-fx-presets.js
 *
 * Quality-tier presets for the post-processing pipeline.
 * Consumed by setupPostProcessing() (zone-setup-methods.js) and the live
 * settings-update path (init/settings.js).
 *
 * Tiers: 'low' | 'medium' | 'high' | 'ultra'
 */

/**
 * Returns Filament bloom options for the given quality tier.
 * Requires the Filament namespace so enum constants can be resolved.
 *
 * @param {string} quality
 * @param {object} Filament - The Filament WASM namespace
 * @returns {object}
 */
export function getBloomQualityConfig(quality = 'medium', Filament) {
    const QualityLevel = Filament?.['View$QualityLevel']
    const BlendMode = Filament?.['View$BloomOptions$BlendMode']
    switch (quality) {
        case 'ultra':
            return {
                enabled: true,
                strength: 0.55,
                resolution: 512,
                levels: 7,
                threshold: true,
                highlight: 10.0,
                blendMode: BlendMode?.ADD,
                quality: QualityLevel?.HIGH,
                lensFlare: true,
            }
        case 'high':
            return {
                enabled: true,
                strength: 0.45,
                resolution: 384,
                levels: 6,
                threshold: true,
                highlight: 9.0,
                blendMode: BlendMode?.ADD,
                quality: QualityLevel?.MEDIUM,
                lensFlare: false,
            }
        case 'medium':
            return {
                enabled: true,
                strength: 0.4,
                resolution: 256,
                levels: 5,
                threshold: true,
                highlight: 8.0,
                blendMode: BlendMode?.ADD,
                quality: QualityLevel?.MEDIUM,
                lensFlare: false,
            }
        case 'low':
        default:
            return {
                enabled: true,
                strength: 0.3,
                resolution: 128,
                levels: 4,
                threshold: true,
                highlight: 8.0,
                blendMode: BlendMode?.ADD,
                quality: QualityLevel?.LOW,
                lensFlare: false,
            }
    }
}

/**
 * Returns Filament ambient-occlusion (SSAO) options for the given quality tier.
 *
 * @param {string} quality
 * @param {object} Filament - The Filament WASM namespace
 * @param {boolean} [enabled=true] - Honour the user's SSAO toggle
 * @returns {object}
 */
export function getSsaoQualityConfig(quality = 'medium', Filament, enabled = true) {
    const QualityLevel = Filament?.['View$QualityLevel']
    switch (quality) {
        case 'ultra':
            return {
                enabled,
                radius: 0.5,
                power: 2.0,
                bias: 0.003,
                resolution: 1.0,
                intensity: 1.2,
                quality: QualityLevel?.HIGH,
            }
        case 'high':
            return {
                enabled,
                radius: 0.4,
                power: 2.0,
                bias: 0.004,
                resolution: 0.75,
                intensity: 1.1,
                quality: QualityLevel?.MEDIUM,
            }
        case 'medium':
            return {
                enabled,
                radius: 0.3,
                power: 2.0,
                bias: 0.005,
                resolution: 0.5,
                intensity: 1.0,
                quality: QualityLevel?.LOW,
            }
        case 'low':
        default:
            return {
                enabled,
                radius: 0.25,
                power: 2.0,
                bias: 0.007,
                resolution: 0.5,
                intensity: 0.8,
                quality: QualityLevel?.LOW,
            }
    }
}

/**
 * Returns Filament vignette options for the given quality tier.
 * Vignette is enabled on high and ultra for a filmic, premium feel.
 *
 * @param {string} quality
 * @returns {object}
 */
export function getVignetteConfig(quality = 'medium') {
    switch (quality) {
        case 'ultra':
            return {
                enabled: true,
                midPoint: 0.7,
                roundness: 0.6,
                feather: 0.5,
                color: [0.0, 0.0, 0.0, 1.0],
            }
        case 'high':
            return {
                enabled: true,
                midPoint: 0.75,
                roundness: 0.6,
                feather: 0.6,
                color: [0.0, 0.0, 0.0, 1.0],
            }
        case 'medium':
        case 'low':
        default:
            return { enabled: false }
    }
}

/**
 * Returns color-grading parameters (contrast, saturation) for the given
 * quality tier.  All tiers use ACES tone-mapping; higher tiers push slightly
 * richer contrast and saturation for a more cinematic look.
 *
 * @param {string} quality
 * @returns {{ contrast: number, saturation: number }}
 */
export function getColorGradingConfig(quality = 'medium') {
    switch (quality) {
        case 'ultra':
            return { contrast: 1.12, saturation: 1.20 }
        case 'high':
            return { contrast: 1.10, saturation: 1.18 }
        case 'low':
            return { contrast: 1.05, saturation: 1.10 }
        case 'medium':
        default:
            return { contrast: 1.08, saturation: 1.15 }
    }
}

/**
 * Returns Filament DoF options for the given camera mode and quality tier.
 * Returns null when DoF should not be active for this combination.
 *
 * DoF is enabled for:
 *   - 'cinematic'         – all quality tiers
 *   - 'follow' / 'action' – high and ultra only (subtle, speed-tracked)
 *
 * @param {string} cameraMode
 * @param {string} quality
 * @param {number} [focusDistance=20] - Distance from camera eye to subject in world units (meters).
 *   Typical cinematic orbit is ~25, follow/action ranges from ~15 to ~35 depending on speed.
 * @returns {object|null}
 */
export function getDofConfig(cameraMode, quality = 'medium', focusDistance = 20) {
    const isHighQuality = quality === 'high' || quality === 'ultra'
    if (cameraMode === 'cinematic') {
        return {
            enabled: true,
            focusDistance,
            blurScale: 1.0,
            cocScale: quality === 'ultra' ? 1.2 : 1.0,
            maxApertureDiameter: 0.01,
        }
    }
    if (isHighQuality && (cameraMode === 'follow' || cameraMode === 'action')) {
        return {
            enabled: true,
            focusDistance,
            blurScale: 0.8,
            cocScale: quality === 'ultra' ? 0.8 : 0.5,
            maxApertureDiameter: 0.006,
        }
    }
    return null
}
