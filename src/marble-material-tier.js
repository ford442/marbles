/**
 * Tiered marble material application — full detail only on player + nearby LOD0 marbles.
 * Dynamic per-frame updates limited to sparkle/heat shimmer on ≤4 marbles.
 */

import {
    materialPresets,
    applyFullPreset,
    createThemedMaterialInstance,
} from './material-system.js';
import { getGlassQualityConfig } from './rendering-defaults.js';

export const MATERIAL_TIER = {
    BASE: 0,
    SIMPLIFIED: 1,
    FULL: 2,
};

export const DETAIL_CAMERA_DIST_M = 15;
export const MAX_FANCY_MARBLES = 4;
export const MATERIAL_TIER_INTERVAL_MS = 500;
export const DYNAMIC_EFFECT_INTERVAL_MS = 100;
export const VOLCANIC_HEAT_SPEED = 12;

/** Maps preset names to shader surfaceType uniform. */
export const SURFACE_TYPE = {
    default: 0,
    stoneVein: 1,
    obsidianMetal: 2,
    volcanicMagma: 3,
    neonGlow: 4,
    classicGlass: 4,
    quantumCrystal: 4,
};

const PRIORITY_PRESETS = new Set([
    'classicGlass',
    'neonGlow',
    'obsidianMetal',
    'volcanicMagma',
    'stoneVein',
]);

const SIMPLIFIED_STRIP = [
    'anisotropy',
    'subsurfaceScattering',
    'grainScale',
    'scratchesIntensity',
    'iridescenceScale',
    'sparkleDensity',
    'crackGlow',
    'heatIntensity',
];

function safeSetFloat(mat, name, value) {
    if (value === undefined || value === null) return;
    try {
        mat.setFloatParameter(name, value);
    } catch (_) { /* optional uniform */ }
}

export function getMaterialDetailConfig(quality = 'medium', autoQualityStep = 0) {
    if (autoQualityStep >= 6) {
        return { bumpOctaves: 0, subsurfaceScale: 0, iridescenceScale: 0, dynamicEffects: false };
    }

    const q = (quality || 'medium').toLowerCase();
    switch (q) {
        case 'ultra':
            return { bumpOctaves: 4, subsurfaceScale: 1.0, iridescenceScale: 1.0, dynamicEffects: true };
        case 'high':
            return { bumpOctaves: 4, subsurfaceScale: 1.0, iridescenceScale: 0.85, dynamicEffects: true };
        case 'medium':
            return { bumpOctaves: 1, subsurfaceScale: 0.45, iridescenceScale: 0.35, dynamicEffects: true };
        case 'low':
        default:
            return { bumpOctaves: 0, subsurfaceScale: 0, iridescenceScale: 0, dynamicEffects: false };
    }
}

export function getSurfaceTypeForPreset(presetName) {
    return SURFACE_TYPE[presetName] ?? SURFACE_TYPE.default;
}

export function resolveMarbleMaterialTier(marble, game) {
    if (!game?.hasProceduralMaterial || !marble?.matInstance) {
        return MATERIAL_TIER.BASE;
    }

    const autoStep = game.autoQualityGovernor?.autoQualityStep ?? 0;
    if (autoStep >= 6) return MATERIAL_TIER.BASE;

    if (marble === game.playerMarble) return MATERIAL_TIER.FULL;

    const lod = marble.lodLevel ?? 1;
    if (lod !== 0) return MATERIAL_TIER.SIMPLIFIED;

    const ref = game._cameraState?.eye;
    if (ref) {
        const t = marble.rigidBody?.translation?.();
        if (t) {
            const dx = t.x - ref[0];
            const dy = t.y - ref[1];
            const dz = t.z - ref[2];
            if (Math.hypot(dx, dy, dz) > DETAIL_CAMERA_DIST_M) {
                return MATERIAL_TIER.SIMPLIFIED;
            }
        }
    }

    const quality = game.settings?.graphics?.quality || 'medium';
    if (quality === 'low') return MATERIAL_TIER.SIMPLIFIED;

    if (quality === 'medium' && !game.marbleLodManager?._nearestLod0Keys?.has(marble)) {
        return MATERIAL_TIER.SIMPLIFIED;
    }

    return MATERIAL_TIER.FULL;
}

export function buildTieredPreset(preset, presetName, tier, quality, autoStep = 0) {
    const detail = getMaterialDetailConfig(quality, autoStep);
    const merged = { ...(preset || {}) };

    if (tier === MATERIAL_TIER.BASE) {
        return {
            color: merged.color,
            baseColor: merged.baseColor || merged.color,
            roughness: merged.roughness ?? 0.4,
            metallic: merged.metallic ?? 0,
            emissive: [0, 0, 0],
            emissiveIntensity: 0,
            refractionMode: 0,
            bumpScale: 0,
            bumpFrequency: 0,
            bumpOctaves: 0,
            subsurfaceStrength: 0,
            anisotropyStrength: 0,
            grainScale: 0,
            scratchesIntensity: 0,
            iridescenceScale: 0,
            sparkleStrength: 0,
            heatShimmer: 0,
            surfaceType: 0,
            environmentIntensity: 1,
            reflectionStrength: 1,
            clearCoat: 0,
        };
    }

    if (tier === MATERIAL_TIER.SIMPLIFIED) {
        for (const key of SIMPLIFIED_STRIP) {
            if (merged[key] !== undefined) merged[key] = 0;
        }
        merged.bumpOctaves = Math.min(detail.bumpOctaves, 1);
        merged.subsurfaceStrength = (merged.subsurfaceScattering || 0) * detail.subsurfaceScale * 0.35;
        merged.anisotropyStrength = 0;
        merged.iridescenceScale = 0;
        merged.sparkleStrength = 0;
        merged.heatShimmer = 0;
        merged.surfaceType = getSurfaceTypeForPreset(presetName) > 0 ? 0.5 : 0;
        if (merged.refractionIndex || presetName === 'classicGlass') {
            const glass = getGlassQualityConfig(quality);
            merged.refractionMode = Math.min(glass.refractionMode, 1.0);
            merged.causticIntensity = (glass.causticIntensity || 0) * 0.6;
            merged.fresnelStrength = glass.fresnelStrength;
        }
        return merged;
    }

    // FULL tier
    merged.bumpOctaves = detail.bumpOctaves;
    merged.subsurfaceStrength = (merged.subsurfaceScattering || 0) * detail.subsurfaceScale;
    merged.anisotropyStrength = merged.anisotropy ?? 0;
    merged.grainScale = merged.grainScale ?? 0;
    merged.scratchesIntensity = merged.scratchesIntensity ?? 0;
    merged.iridescenceScale = (merged.iridescenceScale ?? 0) * detail.iridescenceScale;
    merged.surfaceType = getSurfaceTypeForPreset(presetName);
    merged.sparkleStrength = 0;
    merged.heatShimmer = 0;

    if (merged.refractionIndex || presetName === 'classicGlass') {
        const glass = getGlassQualityConfig(quality);
        Object.assign(merged, {
            refractionMode: glass.refractionMode,
            thickness: glass.thickness,
            causticIntensity: glass.causticIntensity,
            chromaticDispersion: glass.chromaticDispersion,
            fresnelStrength: glass.fresnelStrength,
        });
    }

    return merged;
}

export function applyMarbleMaterialUniforms(matInstance, preset, game, tier, presetName) {
    if (!matInstance || !preset || !game?.Filament) return;

    applyFullPreset(matInstance, preset, game.hasProceduralMaterial, game.Filament);

    if (!game.hasProceduralMaterial) return;

    safeSetFloat(matInstance, 'bumpOctaves', preset.bumpOctaves ?? 0);
    safeSetFloat(matInstance, 'surfaceType', preset.surfaceType ?? 0);
    safeSetFloat(matInstance, 'subsurfaceStrength', preset.subsurfaceStrength ?? 0);
    safeSetFloat(matInstance, 'anisotropyStrength', preset.anisotropyStrength ?? 0);
    safeSetFloat(matInstance, 'grainScale', preset.grainScale ?? 0);
    safeSetFloat(matInstance, 'scratchesIntensity', preset.scratchesIntensity ?? 0);
    safeSetFloat(matInstance, 'iridescenceScale', preset.iridescenceScale ?? 0);
    safeSetFloat(matInstance, 'sparkleStrength', preset.sparkleStrength ?? 0);
    safeSetFloat(matInstance, 'heatShimmer', preset.heatShimmer ?? 0);
    safeSetFloat(matInstance, 'effectTime', (performance.now() % 60000) / 1000);
}

export function applyMarbleMaterialPreset(marble, game, tier = null) {
    if (!marble?.matInstance) return tier ?? MATERIAL_TIER.BASE;

    const presetName = marble.materialPresetName || 'polishedMarble';
    const basePreset = marble.materialPreset || materialPresets[presetName] || materialPresets.polishedMarble;
    const resolvedTier = tier ?? resolveMarbleMaterialTier(marble, game);
    const quality = game.settings?.graphics?.quality || 'medium';
    const autoStep = game.autoQualityGovernor?.autoQualityStep ?? 0;
    const tiered = buildTieredPreset(basePreset, presetName, resolvedTier, quality, autoStep);

    applyMarbleMaterialUniforms(marble.matInstance, tiered, game, resolvedTier, presetName);
    marble._materialTier = resolvedTier;
    marble._materialTierPreset = presetName;
    return resolvedTier;
}

export function createMarbleMaterialInstance(game, presetName, baseColor, tier = MATERIAL_TIER.SIMPLIFIED) {
    const { instance, preset } = createThemedMaterialInstance(
        game.material,
        game.Filament,
        presetName,
        baseColor,
        game.hasProceduralMaterial
    );

    const quality = game.settings?.graphics?.quality || 'medium';
    const autoStep = game.autoQualityGovernor?.autoQualityStep ?? 0;
    const tiered = buildTieredPreset(preset, presetName, tier, quality, autoStep);
    applyMarbleMaterialUniforms(instance, tiered, game, tier, presetName);

    return { instance, preset, tiered };
}

export function updateMarbleMaterialTiers(game, now = performance.now()) {
    if (!game?.marbles?.length || !game.hasProceduralMaterial) {
        game._fancyPresetCount = 0;
        return 0;
    }

    if (now - (game._lastMaterialTierUpdate || 0) < MATERIAL_TIER_INTERVAL_MS) {
        return game._fancyPresetCount ?? 0;
    }
    game._lastMaterialTierUpdate = now;

    let fancy = 0;
    for (const marble of game.marbles) {
        const tier = resolveMarbleMaterialTier(marble, game);
        if (tier === MATERIAL_TIER.FULL) fancy += 1;
        if (tier !== marble._materialTier) {
            applyMarbleMaterialPreset(marble, game, tier);
        }
    }

    game._fancyPresetCount = fancy;
    if (typeof window !== 'undefined') {
        window.fancyPresetCount = fancy;
    }
    return fancy;
}

export function shouldRunDynamicMarbleEffects(marble, game) {
    if (!game?.hasProceduralMaterial) return false;
    if ((game.autoQualityGovernor?.autoQualityStep ?? 0) >= 6) return false;
    const detail = getMaterialDetailConfig(
        game.settings?.graphics?.quality,
        game.autoQualityGovernor?.autoQualityStep
    );
    if (!detail.dynamicEffects) return false;
    if (marble._materialTier !== MATERIAL_TIER.FULL) return false;
    if (!PRIORITY_PRESETS.has(marble.materialPresetName)) return false;

    const ref = game._cameraState?.eye;
    if (ref) {
        const t = marble.rigidBody?.translation?.();
        if (t) {
            const dist = Math.hypot(t.x - ref[0], t.y - ref[1], t.z - ref[2]);
            if (dist > DETAIL_CAMERA_DIST_M) return false;
        }
    }
    return true;
}

export function updateMarbleDynamicMaterialEffects(game, now, perfCounts = null) {
    if (!game?.marbles?.length || !game.hasProceduralMaterial) return;

    if (now - (game._lastDynamicMatFx || 0) < DYNAMIC_EFFECT_INTERVAL_MS) return;
    game._lastDynamicMatFx = now;

    const effectTime = (now % 60000) / 1000;
    let updates = 0;
    let skipped = 0;

    const candidates = [];
    for (const marble of game.marbles) {
        if (!shouldRunDynamicMarbleEffects(marble, game)) continue;
        if (marble === game.playerMarble) {
            candidates.unshift(marble);
        } else {
            candidates.push(marble);
        }
    }

    const limited = candidates.slice(0, MAX_FANCY_MARBLES);

    for (const marble of limited) {
        const presetName = marble.materialPresetName;
        const mat = marble.matInstance;
        if (!mat) continue;

        let sparkle = 0;
        let heat = 0;

        if (presetName === 'neonGlow' || presetName === 'classicGlass' || presetName === 'quantumCrystal') {
            sparkle = marble.materialPreset?.sparkleDensity ?? marble.materialPreset?.iridescenceScale ?? 0.4;
            sparkle *= 0.35;
        }

        if (presetName === 'volcanicMagma') {
            const vel = marble.rigidBody?.linvel?.();
            const speed = vel ? Math.hypot(vel.x, vel.y, vel.z) : 0;
            if (speed > VOLCANIC_HEAT_SPEED) {
                heat = Math.min(0.12, (speed - VOLCANIC_HEAT_SPEED) * 0.004 * (marble.materialPreset?.heatIntensity ?? 1));
            }
        }

        const last = marble._lastDynamicFx || {};
        const changed =
            Math.abs((last.sparkle ?? 0) - sparkle) > 0.02 ||
            Math.abs((last.heat ?? 0) - heat) > 0.005 ||
            Math.abs((last.effectTime ?? 0) - effectTime) > 0.15;

        if (!changed) {
            skipped += 1;
            continue;
        }

        safeSetFloat(mat, 'sparkleStrength', sparkle);
        safeSetFloat(mat, 'heatShimmer', heat);
        safeSetFloat(mat, 'effectTime', effectTime);
        marble._lastDynamicFx = { sparkle, heat, effectTime };
        updates += 1;
    }

    if (perfCounts) {
        perfCounts.marbleDynamicFxUpdates = updates;
        perfCounts.marbleDynamicFxSkipped = skipped;
    }
}

export default {
    MATERIAL_TIER,
    applyMarbleMaterialPreset,
    createMarbleMaterialInstance,
    updateMarbleMaterialTiers,
    updateMarbleDynamicMaterialEffects,
    resolveMarbleMaterialTier,
    getMaterialDetailConfig,
};
