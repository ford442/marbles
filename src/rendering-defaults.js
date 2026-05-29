export const DEFAULT_SSAO_INTENSITY = 1.0
export const DEFAULT_MSAA_SAMPLE_COUNT = 4

export function getPostFxQualityFlags(quality = 'medium') {
    const taaEnabled = quality !== 'low'
    const heavyFxEnabled = quality === 'high' || quality === 'ultra'
    const vignetteEnabled = heavyFxEnabled
    const dofEnabled = true // DoF is gated per camera-mode inside getDofConfig()

    return {
        taaEnabled,
        heavyFxEnabled,
        motionBlurEnabled: heavyFxEnabled,
        ssrEnabled: heavyFxEnabled,
        vignetteEnabled,
        dofEnabled,
    }
}

// Re-export quality-specific helpers from the dedicated presets module so that
// existing importers can continue to pull everything from rendering-defaults.js.
export { getBloomQualityConfig, getSsaoQualityConfig, getVignetteConfig, getColorGradingConfig, getDofConfig } from './rendering/post-fx-presets.js'

/**
 * Returns shadow configuration objects keyed by quality tier.
 * All three objects (shadowOptions, vsmOptions, softOptions) are returned;
 * vsmOptions and softOptions may be null for lower quality tiers.
 *
 * @param {string} quality - 'low' | 'medium' | 'high' | 'ultra'
 * @returns {{ shadowOptions: object, vsmOptions: object|null, softOptions: object|null }}
 */
export function getShadowQualityConfig(quality = 'medium') {
    switch (quality) {
        case 'ultra':
            return {
                shadowOptions: {
                    mapSize: 4096,
                    cascades: 2,
                    constantBias: 0.0003,
                    normalBias: 1.0,
                    shadowNearHint: 0.1,
                    shadowFarHint: 200.0,
                    stable: true,
                    polygonOffsetConstant: 0.1,
                    polygonOffsetSlope: 0.8,
                    screenSpaceContactShadows: true,
                    stepCount: 16,
                },
                vsmOptions: {
                    anisotropy: 1,
                    mipmapping: true,
                    msaaSamples: 4,
                    highPrecision: true,
                    minVarianceScale: 0.5,
                    lightBleedReduction: 0.2,
                },
                softOptions: {
                    penumbraScale: 2.0,
                    penumbraRatioScale: 0.5,
                },
            }
        case 'high':
            return {
                shadowOptions: {
                    mapSize: 2048,
                    cascades: 2,
                    constantBias: 0.0005,
                    normalBias: 1.5,
                    shadowNearHint: 0.1,
                    shadowFarHint: 200.0,
                    stable: true,
                    polygonOffsetConstant: 0.2,
                    polygonOffsetSlope: 1.0,
                    screenSpaceContactShadows: true,
                    stepCount: 16,
                },
                vsmOptions: {
                    anisotropy: 1,
                    mipmapping: true,
                    msaaSamples: 2,
                    highPrecision: false,
                    minVarianceScale: 0.5,
                    lightBleedReduction: 0.2,
                },
                softOptions: null,
            }
        case 'medium':
            return {
                shadowOptions: {
                    mapSize: 1024,
                    cascades: 1,
                    constantBias: 0.001,
                    normalBias: 2.0,
                    stable: true,
                    screenSpaceContactShadows: false,
                },
                vsmOptions: null,
                softOptions: null,
            }
        case 'low':
        default:
            return {
                shadowOptions: {
                    mapSize: 512,
                    cascades: 1,
                    constantBias: 0.002,
                    normalBias: 2.5,
                    stable: false,
                    screenSpaceContactShadows: false,
                },
                vsmOptions: null,
                softOptions: null,
            }
    }
}
