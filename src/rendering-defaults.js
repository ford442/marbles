export const DEFAULT_SSAO_INTENSITY = 1.0
export const DEFAULT_MSAA_SAMPLE_COUNT = 4

/** Default graphics quality when settings are not yet loaded at engine init. */
export const DEFAULT_GRAPHICS_QUALITY = 'medium'

/**
 * Read persisted graphics quality from localStorage (mirrors init/settings.js key).
 * Used before `loadSettings()` runs so WebGL context matches saved tier.
 * @returns {string}
 */
export function resolveGraphicsQualityForInit(fallback = DEFAULT_GRAPHICS_QUALITY) {
    if (typeof localStorage === 'undefined') return fallback
    try {
        const saved = localStorage.getItem('marbles3d_settings')
        if (!saved) return fallback
        const parsed = JSON.parse(saved)
        return parsed?.graphics?.quality || fallback
    } catch {
        return fallback
    }
}

/**
 * Lightweight platform hints for context attribute selection.
 * @returns {{ isMobile: boolean, prefersLowPower: boolean }}
 */
export function detectPlatformProfile() {
    if (typeof navigator === 'undefined') {
        return { isMobile: false, prefersLowPower: false }
    }
    const ua = navigator.userAgent || ''
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    const cores = navigator.hardwareConcurrency || 8
    const prefersLowPower = isMobile || cores <= 4
    return { isMobile, prefersLowPower }
}

function isSafariBrowser() {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua)
}

/**
 * WebGL2 context attributes for Filament `Engine.create(canvas, options)`.
 *
 * Canvas `antialias` stays false — anti-aliasing is handled at the Filament View
 * via MSAA (when TAA is off) or TAA. Enabling browser MSAA here would double the cost.
 *
 * @param {string} [quality='medium']
 * @param {{ isMobile?: boolean, prefersLowPower?: boolean }} [platform]
 * @returns {Record<string, unknown>}
 */
export function getWebGLContextOptions(quality = DEFAULT_GRAPHICS_QUALITY, platform = detectPlatformProfile()) {
    const tier = (quality || DEFAULT_GRAPHICS_QUALITY).toLowerCase()
    const mobile = platform.isMobile ?? detectPlatformProfile().isMobile

    /** @type {Record<string, unknown>} */
    const options = {
        majorVersion: 2,
        minorVersion: 0,
        depth: true,
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
        xrCompatible: false,
        desynchronized: false,
        powerPreference: 'default',
    }

    switch (tier) {
        case 'low':
            options.powerPreference = 'low-power'
            break
        case 'medium':
        case 'high':
            options.powerPreference = 'high-performance'
            // Lower input latency on desktop; skip on mobile/Safari for compatibility.
            if (!mobile && !isSafariBrowser()) {
                options.desynchronized = true
            }
            break
        case 'ultra':
            options.powerPreference = 'high-performance'
            options.desynchronized = false
            break
        default:
            options.powerPreference = platform.prefersLowPower ? 'low-power' : 'high-performance'
    }

    return options
}

/**
 * Context options for the simple WebGL2 debug renderer (`?renderer=simple`).
 * Same tier matrix as Filament; keeps `preserveDrawingBuffer` for readback/screenshots.
 * @param {string} [quality]
 */
export function getSimpleDebugWebGLContextOptions(quality = DEFAULT_GRAPHICS_QUALITY) {
    return {
        ...getWebGLContextOptions(quality),
        preserveDrawingBuffer: true,
    }
}

const DEV_GL_PARAM_MAP = {
    glPowerPreference: 'powerPreference',
    glAlpha: 'alpha',
    glDesynchronized: 'desynchronized',
    glPreserveDrawingBuffer: 'preserveDrawingBuffer',
    glFailIfMajorPerformanceCaveat: 'failIfMajorPerformanceCaveat',
    glAntialias: 'antialias',
    glXrCompatible: 'xrCompatible',
}

function parseDevBool(value) {
    if (value === '1' || value === 'true') return true
    if (value === '0' || value === 'false') return false
    return undefined
}

/**
 * Merge dev-only URL overrides into context options (`?glDesynchronized=0`, etc.).
 * @param {Record<string, unknown>} baseOptions
 * @returns {Record<string, unknown>}
 */
export function applyDevWebGLContextOverrides(baseOptions) {
    if (typeof window === 'undefined') return baseOptions
    const params = new URLSearchParams(window.location.search)
    const merged = { ...baseOptions }

    for (const [param, key] of Object.entries(DEV_GL_PARAM_MAP)) {
        if (!params.has(param)) continue
        const raw = params.get(param)
        if (key === 'powerPreference') {
            if (raw === 'low-power' || raw === 'high-performance' || raw === 'default') {
                merged[key] = raw
            }
            continue
        }
        const parsed = parseDevBool(raw)
        if (parsed !== undefined) merged[key] = parsed
    }

    return merged
}

/**
 * Quality-aware WebGL2 options with optional dev URL overrides.
 * @param {{ quality?: string, forSimpleDebug?: boolean }} [config]
 */
export function resolveWebGLContextOptions(config = {}) {
    const quality = config.quality ?? resolveGraphicsQualityForInit()
    const base = config.forSimpleDebug
        ? getSimpleDebugWebGLContextOptions(quality)
        : getWebGLContextOptions(quality)
    return applyDevWebGLContextOverrides(base)
}

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
export { getBloomQualityConfig, getSsaoQualityConfig, getVignetteConfig, getColorGradingConfig, getDofConfig, getFogQualityConfig, getEnvironmentFogPreset, getGlassQualityConfig } from './rendering/post-fx-presets.js'

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
