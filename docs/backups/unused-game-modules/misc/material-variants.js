/**
 * material-variants.js
 *
 * A lightweight registry that maps named surface variants to parameter
 * overrides on top of the base trackSurfacePresets.
 *
 * Usage:
 *   import { resolveVariant } from './rendering/material-variants.js'
 *   const params = resolveVariant('ice-with-env')  // -> merged preset object
 *
 * When IBL cubemaps land (Issue #287), the `environmentIntensity` /
 * `reflectionStrength` / `clearCoatIor` fields stored here will be
 * automatically consumed by `applyFullPreset` without any further code change.
 */

import { trackSurfacePresets, zoneSurfaceMapping } from '../material-system.js'

// ---------------------------------------------------------------------------
// Variant registry — each entry is a named set of overrides layered on top of
// an existing trackSurfacePreset.  Fields not listed here fall through to the
// base preset.
// ---------------------------------------------------------------------------
export const materialVariants = {
    'ice-with-env': {
        base: 'ice',
        environmentIntensity: 1.6,
        reflectionStrength: 1.0,
        clearCoatIor: 1.31,
        bumpScale: 0.003,
        bumpFrequency: 90.0,
    },
    'obsidian-with-rim': {
        base: 'obsidian',
        environmentIntensity: 1.4,
        reflectionStrength: 0.95,
        clearCoatIor: 1.5,
        rimLightColor: [0.9, 0.95, 1.0],
        rimLightIntensity: 0.8,
    },
    'crystal-with-sss': {
        base: 'crystal',
        environmentIntensity: 1.5,
        reflectionStrength: 1.0,
        clearCoatIor: 1.77,
        subsurfaceScattering: 0.9,
        bumpScale: 0.003,
        bumpFrequency: 120.0,
    },
    'volcanic-glowing': {
        base: 'volcanicRock',
        emissive: [0.5, 0.15, 0.0],
        emissiveIntensity: 0.4,
        environmentIntensity: 0.6,
        reflectionStrength: 0.15,
        bumpScale: 0.25,
        bumpFrequency: 10.0,
    },
    'metal-polished': {
        base: 'metal',
        roughness: 0.1,
        environmentIntensity: 1.8,
        reflectionStrength: 1.0,
        bumpScale: 0.01,
        bumpFrequency: 50.0,
    },
    'concrete-worn': {
        base: 'concrete',
        roughness: 1.0,
        bumpScale: 0.18,
        bumpFrequency: 18.0,
        environmentIntensity: 0.2,
        reflectionStrength: 0.05,
    },
    'sand-dry': {
        base: 'sand',
        roughness: 1.0,
        bumpScale: 0.2,
        bumpFrequency: 12.0,
        environmentIntensity: 0.15,
        reflectionStrength: 0.0,
    },
    'wood-aged': {
        base: 'wood',
        roughness: 0.75,
        bumpScale: 0.1,
        bumpFrequency: 14.0,
        environmentIntensity: 0.35,
        reflectionStrength: 0.1,
    },
}

// ---------------------------------------------------------------------------
// resolveVariant(nameOrZoneType) → merged preset object or null
//
// Resolution order:
//  1. Direct variant name lookup ("ice-with-env")
//  2. Zone type → surface key via zoneSurfaceMapping, then base preset
//  3. Direct trackSurfacePresets key ("ice", "metal", …)
//  4. Returns null if nothing matches
// ---------------------------------------------------------------------------
export function resolveVariant(nameOrZoneType) {
    // 1. Named variant
    const variant = materialVariants[nameOrZoneType]
    if (variant) {
        const basePreset = trackSurfacePresets[variant.base]
        if (!basePreset) {
            console.warn(`[material-variants] Unknown base preset "${variant.base}" for variant "${nameOrZoneType}"`)
        }
        // Merge: base preset first, then variant overrides
        return Object.assign({}, basePreset || {}, variant)
    }

    // 2. Zone type → surface mapping
    const surfaceKey = zoneSurfaceMapping[nameOrZoneType]
    if (surfaceKey) {
        return trackSurfacePresets[surfaceKey] || null
    }

    // 3. Direct surface preset key
    return trackSurfacePresets[nameOrZoneType] || null
}
