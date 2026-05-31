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
 * Returns per-environment color-grading overrides to layer on top of the
 * quality-tier base from getColorGradingConfig().  Only the keys present in
 * the returned object will override the base; omitted keys retain the quality
 * default.
 *
 * Fields:
 *   contrast   – ACES contrast multiplier (1.0 = neutral)
 *   saturation – Global saturation multiplier (1.0 = neutral)
 *   vibrance   – Vibrance (protects already-saturated hues; 0 = off, applied
 *                with a safe try-catch in case the Filament build omits it)
 *
 * @param {string} envName - Environment preset key (matches ENVIRONMENT_PRESETS)
 * @returns {{ contrast: number, saturation: number, vibrance?: number }}
 */
export function getEnvironmentColorGradingPreset(envName = 'default') {
    switch (envName) {
        // Volcanic: punchy crushed blacks, slightly warm saturation.
        // Smoke and ash reduce mid-tone chroma, but lava pops vividly.
        case 'volcanic':
            return { contrast: 1.22, saturation: 1.08, vibrance: -0.05 }

        // Ice / Arctic: flat diffuse light, cool and desaturated.
        // Lifted shadows simulate snow's ambient scatter.
        case 'ice':
            return { contrast: 1.03, saturation: 0.85, vibrance: 0.08 }

        // Underwater abyss: murky, teal-shifted, colour-starved.
        // Water absorbs warm wavelengths — heavy desaturation sells depth.
        case 'underwater':
            return { contrast: 1.13, saturation: 0.70, vibrance: 0.05 }

        // Space nebula: dramatic deep-space contrast, vivid nebula hues.
        case 'space_nebula':
            return { contrast: 1.18, saturation: 1.28, vibrance: 0.10 }

        // Neon city: high-contrast street photography look, hyper-vivid neon.
        case 'neon_city':
            return { contrast: 1.20, saturation: 1.40, vibrance: 0.15 }

        // Default studio: let the quality-tier baseline speak for itself.
        case 'default':
        default:
            return {}
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

/**
 * Returns Filament fog options for the given quality tier.
 * Fog is disabled for 'low', minimal for 'medium', and scales with quality for 'high'/'ultra'.
 *
 * Fog parameters:
 *   - enabled: boolean
 *   - distance: distance from camera where fog reaches full opacity (world units)
 *   - maximumVisibleDistance: max fog distance (set to 2x distance for smooth falloff)
 *   - fogColorMode: 0=solid color, 1=sky-based
 *   - color: RGBA fog tint (used when colorMode=0)
 *   - density: exponential fog density factor (higher = denser)
 *   - inScatteringStart: where in-scattering begins (distance)
 *   - inScatteringSize: thickness of in-scattering effect
 *   - skyDistance: sky box distance
 *   - heightFalloff: how quickly fog fades with height (0=uniform, 1=max falloff)
 *
 * @param {string} quality
 * @returns {object}
 */
export function getFogQualityConfig(quality = 'medium') {
    switch (quality) {
        case 'ultra':
            return {
                enabled: true,
                distance: 80.0,
                maximumVisibleDistance: 160.0,
                fogColorMode: 1,
                color: [0.5, 0.5, 0.5, 1.0],
                density: 0.012,
                inScatteringStart: 40.0,
                inScatteringSize: 80.0,
                skyDistance: 150.0,
                heightFalloff: 0.15,
            }
        case 'high':
            return {
                enabled: true,
                distance: 70.0,
                maximumVisibleDistance: 140.0,
                fogColorMode: 1,
                color: [0.5, 0.5, 0.5, 1.0],
                density: 0.010,
                inScatteringStart: 35.0,
                inScatteringSize: 70.0,
                skyDistance: 130.0,
                heightFalloff: 0.12,
            }
        case 'medium':
            return {
                enabled: true,
                distance: 60.0,
                maximumVisibleDistance: 120.0,
                fogColorMode: 1,
                color: [0.5, 0.5, 0.5, 1.0],
                density: 0.008,
                inScatteringStart: 30.0,
                inScatteringSize: 60.0,
                skyDistance: 110.0,
                heightFalloff: 0.10,
            }
        case 'low':
        default:
            return { enabled: false }
    }
}

/**
 * Returns environment-specific fog overrides for the given environment name.
 * Merged with the quality-tier config returned by getFogQualityConfig().
 *
 * Environments define:
 *   - color: RGB tint for fog (if fogColorMode=0)
 *   - distance: custom fog distance for mood
 *   - density: custom exponential density
 *   - heightFalloff: how fog thins toward sky
 *
 * @param {string} envName - Environment preset name (e.g., 'default', 'space_nebula', 'underwater')
 * @returns {object} Partial fog config to merge with quality config
 */
export function getEnvironmentFogPreset(envName = 'default') {
    switch (envName) {
        // Deep space: thin, purple-tinted fog fading to void
        case 'space_nebula':
            return {
                color: [0.1, 0.05, 0.25, 1.0],
                distance: 100.0,
                density: 0.006,
                heightFalloff: 0.08,
                inScatteringSize: 100.0,
            }

        // Arctic glacier: crisp blue-white fog, thin
        case 'ice':
            return {
                color: [0.7, 0.85, 1.0, 1.0],
                distance: 80.0,
                density: 0.005,
                heightFalloff: 0.05,
                inScatteringSize: 40.0,
            }

        // Volcanic: thick brown/orange smoke
        case 'volcanic':
            return {
                color: [0.6, 0.4, 0.2, 1.0],
                distance: 50.0,
                density: 0.015,
                heightFalloff: 0.20,
                inScatteringSize: 80.0,
            }

        // Neon city: dark teal fog
        case 'neon_city':
            return {
                color: [0.1, 0.4, 0.5, 1.0],
                distance: 70.0,
                density: 0.009,
                heightFalloff: 0.12,
                inScatteringSize: 60.0,
            }

        // Underwater abyss: dense, dark teal with high height falloff
        case 'underwater':
            return {
                color: [0.05, 0.15, 0.25, 1.0],
                distance: 40.0,
                density: 0.020,
                heightFalloff: 0.25,
                inScatteringStart: 20.0,
                inScatteringSize: 40.0,
            }

        // Default: neutral gray fog
        case 'default':
        default:
            return {
                color: [0.6, 0.6, 0.65, 1.0],
                distance: 75.0,
                density: 0.008,
                heightFalloff: 0.10,
                inScatteringSize: 60.0,
            }
    }
}

/**
 * Glass refraction quality configuration per quality tier.
 * Supports quality-gated glass rendering: low/medium = cheap opaque + Fresnel,
 * high/ultra = full refraction + caustics + chromatic dispersion.
 *
 * @param {string} quality - Quality tier: 'low', 'medium', 'high', 'ultra'
 * @returns {object} Glass refraction config with refractionMode and effect strength
 */
export function getGlassQualityConfig(quality = 'medium') {
    switch (quality?.toLowerCase()) {
        case 'ultra':
            // Full refraction + advanced caustics + strong dispersion
            return {
                refractionMode: 2.0,        // Full refraction mode
                thickness: 0.3,            // Normal caustics modulation
                causticIntensity: 0.7,     // Strong caustics
                chromaticDispersion: 1.5,  // Strong RGB split
                fresnelStrength: 0.8,      // Prominent edge lights
            }

        case 'high':
            // Refraction + caustics + moderate dispersion
            return {
                refractionMode: 2.0,       // Full refraction mode
                thickness: 0.35,
                causticIntensity: 0.6,
                chromaticDispersion: 1.0,
                fresnelStrength: 0.7,
            }

        case 'medium':
            // Fake caustics only (no refraction) + Fresnel
            return {
                refractionMode: 1.0,       // Cheap caustics mode
                thickness: 0.4,
                causticIntensity: 0.5,
                chromaticDispersion: 0.2,  // Minimal dispersion
                fresnelStrength: 0.6,
            }

        case 'low':
        default:
            // Minimal glass effects (no refraction, no caustics)
            return {
                refractionMode: 0.0,       // Off — normal opaque rendering
                thickness: 1.0,
                causticIntensity: 0.0,
                chromaticDispersion: 0.0,
                fresnelStrength: 0.3,      // Subtle rim only
            }
    }
}

/**
 * Returns quality-tiered configuration for the volumetric light shaft system.
 *
 * @param {string} quality
 * @returns {{ maxShafts:number, shaftOpacity:number, caustics:boolean }}
 */
export function getVolumetricConfig(quality = 'medium') {
    const map = {
        low:    { maxShafts: 0, shaftOpacity: 0,    caustics: false },
        medium: { maxShafts: 2, shaftOpacity: 0.25,  caustics: false },
        high:   { maxShafts: 4, shaftOpacity: 0.40,  caustics: true },
        ultra:  { maxShafts: 6, shaftOpacity: 0.55,  caustics: true },
    }
    return map[quality] || map.medium
}
