export const DEFAULT_SSAO_INTENSITY = 1.0
export const DEFAULT_MSAA_SAMPLE_COUNT = 4

export function getPostFxQualityFlags(quality = 'medium') {
    const taaEnabled = quality !== 'low'
    const heavyFxEnabled = quality === 'high' || quality === 'ultra'

    return {
        taaEnabled,
        heavyFxEnabled,
        motionBlurEnabled: heavyFxEnabled,
        ssrEnabled: heavyFxEnabled,
    }
}
