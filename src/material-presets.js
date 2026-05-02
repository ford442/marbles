/**
 * Material Presets — Extracted from experimental rendering layer
 * Provides advanced PBR configurations for marbles and zone surfaces.
 */

// ---------------------------------------------------------------------------
// Marble Theme Presets (from src/visuals/MarbleVisual.ts + agent1/materials/*.ts)
// ---------------------------------------------------------------------------

export const marbleMaterialPresets = {
    classicGlass: {
        color: [0.85, 0.9, 1.0],
        roughness: 0.05,
        metallic: 0.0,
        reflectance: 0.5,
        clearCoat: 1.0,
        clearCoatRoughness: 0.05,
        bumpScale: 0.0,
        bumpFrequency: 0.0,
        anisotropy: 0.0,
        emissive: [0.0, 0.0, 0.0],
        emissiveIntensity: 0.0,
        rimLightColor: [0.6, 0.8, 1.0],
        rimLightIntensity: 0.8,
        subsurfaceScattering: 0.4,
        ambientOcclusion: 0.2,
        // Glass-specific extras
        refractionIndex: 1.52,
        causticIntensity: 0.55,
    },
    obsidianMetal: {
        color: [0.08, 0.08, 0.1],
        roughness: 0.25,
        metallic: 0.95,
        reflectance: 1.0,
        clearCoat: 0.3,
        clearCoatRoughness: 0.2,
        bumpScale: 0.03,
        bumpFrequency: 40.0,
        anisotropy: 0.75,
        emissive: [0.0, 0.0, 0.0],
        emissiveIntensity: 0.0,
        rimLightColor: [0.9, 0.95, 1.0],
        rimLightIntensity: 0.6,
        subsurfaceScattering: 0.1,
        ambientOcclusion: 0.4,
        // Obsidian-specific extras
        grainScale: 10.0,
        scratchesIntensity: 0.35,
    },
    neonGlow: {
        color: [0.95, 0.0, 0.6],
        roughness: 0.2,
        metallic: 0.3,
        reflectance: 0.3,
        clearCoat: 0.6,
        clearCoatRoughness: 0.1,
        bumpScale: 0.01,
        bumpFrequency: 60.0,
        anisotropy: 0.0,
        emissive: [0.95, 0.0, 0.6],
        emissiveIntensity: 2.5,
        rimLightColor: [0.0, 1.0, 0.8],
        rimLightIntensity: 1.5,
        subsurfaceScattering: 0.2,
        ambientOcclusion: 0.1,
        // Neon-specific extras
        glowIntensity: 2.5,
        hologramSpeed: 1.2,
        iridescenceScale: 0.75,
    },
    stoneVein: {
        color: [0.5, 0.42, 0.35],
        roughness: 0.85,
        metallic: 0.0,
        reflectance: 0.1,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        bumpScale: 0.12,
        bumpFrequency: 25.0,
        anisotropy: 0.0,
        emissive: [0.0, 0.0, 0.0],
        emissiveIntensity: 0.0,
        rimLightColor: [0.7, 0.6, 0.5],
        rimLightIntensity: 0.3,
        subsurfaceScattering: 0.6,
        ambientOcclusion: 0.8,
        // Stone-specific extras
        sssThickness: 3.5,
        sparkleDensity: 1.25,
    },
    quantumCrystal: {
        color: [0.45, 0.12, 0.85],
        roughness: 0.15,
        metallic: 0.6,
        reflectance: 0.7,
        clearCoat: 0.8,
        clearCoatRoughness: 0.05,
        bumpScale: 0.02,
        bumpFrequency: 80.0,
        anisotropy: 0.5,
        emissive: [0.2, 0.05, 0.4],
        emissiveIntensity: 0.8,
        rimLightColor: [0.0, 0.95, 1.0],
        rimLightIntensity: 1.2,
        subsurfaceScattering: 0.35,
        ambientOcclusion: 0.3,
        // Quantum-specific extras
        iridescenceScale: 0.95,
        phaseShift: 0.33,
    },
    volcanicMagma: {
        color: [0.15, 0.05, 0.02],
        roughness: 0.95,
        metallic: 0.1,
        reflectance: 0.1,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        bumpScale: 0.15,
        bumpFrequency: 20.0,
        anisotropy: 0.0,
        emissive: [1.0, 0.3, 0.0],
        emissiveIntensity: 1.5,
        rimLightColor: [1.0, 0.4, 0.0],
        rimLightIntensity: 2.0,
        subsurfaceScattering: 0.0,
        ambientOcclusion: 1.0,
        // Volcanic-specific extras
        lavaFlowSpeed: 0.8,
        crackGlow: 0.9,
        heatIntensity: 1.2,
    },
    shadowNinja: {
        color: [0.02, 0.01, 0.03],
        roughness: 0.05,
        metallic: 0.8,
        reflectance: 0.9,
        clearCoat: 0.2,
        clearCoatRoughness: 0.1,
        bumpScale: 0.01,
        bumpFrequency: 50.0,
        anisotropy: 0.0,
        emissive: [0.4, 0.1, 0.6],
        emissiveIntensity: 0.5,
        rimLightColor: [0.6, 0.2, 0.9],
        rimLightIntensity: 3.0,
        subsurfaceScattering: 0.05,
        ambientOcclusion: 0.9,
        // Shadow-specific extras
        voidAbsorption: 0.8,
        smokeIntensity: 0.4,
        shadowSpeed: 0.3,
    },
    galacticCore: {
        color: [0.1, 0.4, 1.0],
        roughness: 0.1,
        metallic: 0.9,
        reflectance: 1.0,
        clearCoat: 0.5,
        clearCoatRoughness: 0.05,
        bumpScale: 0.01,
        bumpFrequency: 100.0,
        anisotropy: 0.0,
        emissive: [0.1, 0.4, 1.0],
        emissiveIntensity: 1.5,
        rimLightColor: [0.6, 0.1, 0.8],
        rimLightIntensity: 1.0,
        subsurfaceScattering: 0.0,
        ambientOcclusion: 0.2,
        // Galactic-specific extras
        coreEnergy: 1.2,
        starDensity: 50.0,
        accretionSpeed: 0.5,
    },
};

// ---------------------------------------------------------------------------
// Track Surface Presets (from src/visuals/agent4/materials/base.ts)
// ---------------------------------------------------------------------------

export const trackSurfacePresets = {
    obsidian: {
        baseColor: [0.05, 0.05, 0.07],
        roughness: 0.15,
        metallic: 0.9,
        reflectance: 1.0,
        clearCoat: 0.4,
        clearCoatRoughness: 0.1,
        subsurfaceScattering: 0.05,
        ambientOcclusion: 0.7,
        emissiveIntensity: 0.0,
        anisotropy: 0.0,
    },
    ice: {
        baseColor: [0.85, 0.92, 1.0],
        roughness: 0.05,
        metallic: 0.0,
        reflectance: 0.8,
        clearCoat: 1.0,
        clearCoatRoughness: 0.02,
        subsurfaceScattering: 0.7,
        ambientOcclusion: 0.2,
        emissiveIntensity: 0.1,
        anisotropy: 0.0,
    },
    rubber: {
        baseColor: [0.15, 0.15, 0.15],
        roughness: 0.85,
        metallic: 0.0,
        reflectance: 0.2,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        subsurfaceScattering: 0.1,
        ambientOcclusion: 0.9,
        emissiveIntensity: 0.0,
        anisotropy: 0.0,
    },
    sand: {
        baseColor: [0.76, 0.70, 0.50],
        roughness: 1.0,
        metallic: 0.0,
        reflectance: 0.0,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        subsurfaceScattering: 0.0,
        ambientOcclusion: 1.0,
        emissiveIntensity: 0.0,
        anisotropy: 0.0,
    },
    volcanicRock: {
        baseColor: [0.12, 0.08, 0.06],
        roughness: 0.95,
        metallic: 0.1,
        reflectance: 0.1,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        subsurfaceScattering: 0.0,
        ambientOcclusion: 1.0,
        emissive: [0.3, 0.1, 0.0],
        emissiveIntensity: 0.15,
        anisotropy: 0.0,
    },
    crystal: {
        baseColor: [0.9, 0.95, 1.0],
        roughness: 0.02,
        metallic: 0.0,
        reflectance: 0.9,
        clearCoat: 0.8,
        clearCoatRoughness: 0.05,
        subsurfaceScattering: 0.8,
        ambientOcclusion: 0.3,
        emissiveIntensity: 0.3,
        anisotropy: 0.0,
    },
    wood: {
        baseColor: [0.4, 0.25, 0.15],
        roughness: 0.6,
        metallic: 0.0,
        reflectance: 0.15,
        clearCoat: 0.1,
        clearCoatRoughness: 0.4,
        subsurfaceScattering: 0.05,
        ambientOcclusion: 0.8,
        emissiveIntensity: 0.0,
        anisotropy: 0.0,
    },
    metal: {
        baseColor: [0.72, 0.73, 0.75],
        roughness: 0.25,
        metallic: 1.0,
        reflectance: 1.0,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        subsurfaceScattering: 0.0,
        ambientOcclusion: 0.5,
        emissiveIntensity: 0.0,
        anisotropy: 0.3,
    },
    concrete: {
        baseColor: [0.35, 0.35, 0.37],
        roughness: 0.9,
        metallic: 0.0,
        reflectance: 0.1,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        subsurfaceScattering: 0.0,
        ambientOcclusion: 1.0,
        emissiveIntensity: 0.0,
        anisotropy: 0.0,
    },
};

// ---------------------------------------------------------------------------
// Zone Type → Surface Mapping (from src/visuals/agent4/zones.ts)
// ---------------------------------------------------------------------------

export const zoneSurfaceMapping = {
    start_line: 'rubber',
    finish_line: 'rubber',
    checkpoint: 'metal',
    boost_pad: 'metal',
    ice_section: 'ice',
    volcanic_path: 'volcanicRock',
    crystal_cave: 'crystal',
    obsidian_bridge: 'obsidian',
    sand_trap: 'sand',
    wooden_ramp: 'wood',
};

// ---------------------------------------------------------------------------
// Color Palettes (from src/visuals/agent1/palettes.ts)
// ---------------------------------------------------------------------------

export const colorPalettes = {
    quantumCrystal: {
        coreViolet: [0.45, 0.12, 0.85],
        energyCyan: [0.0, 0.95, 1.0],
        phaseMagenta: [0.95, 0.0, 0.65],
        voidBlack: [0.02, 0.0, 0.08],
        prismWhite: [0.98, 0.95, 1.0],
        entanglementGold: [1.0, 0.85, 0.3],
    },
    glass: {
        base: [0.15, 0.35, 0.55],
        rim: [0.6, 0.9, 1.0],
        caustic: [1.0, 0.95, 0.75],
    },
    obsidian: {
        base: [0.02, 0.02, 0.03],
        metallic: [0.12, 0.12, 0.15],
        heat: [0.8, 0.3, 0.05],
    },
    neon: {
        core: [0.0, 1.0, 0.9],
        pulse: [1.0, 0.0, 0.6],
        circuit: [0.4, 0.0, 1.0],
    },
    stone: {
        base: [0.88, 0.85, 0.80],
        vein: [0.35, 0.30, 0.40],
        sssWarm: [1.0, 0.82, 0.65],
    },
};

// ---------------------------------------------------------------------------
// LOD Distance Thresholds (from src/visuals/MarbleVisual.ts + agent4/quality.ts)
// ---------------------------------------------------------------------------

export const lodThresholds = {
    highEnd: {
        ultra: 10,   // 0-10m: full detail
        high: 30,    // 10-30m: reduced particles
        medium: 60,  // 30-60m: simplified shaders
        low: Infinity,// 60m+: billboard / impostor
    },
    mobile: {
        medium: 15,
        low: 30,
        minimal: Infinity,
    },
};

// ---------------------------------------------------------------------------
// Reflection Probe Defaults (from src/visuals/agent4/probes/creation.ts)
// ---------------------------------------------------------------------------

export const reflectionProbeDefaults = {
    default: {
        position: [0, 5, 0],
        radius: 20.0,
        resolution: 128,
        updateMode: 'static',
        updateInterval: 0,
        intensity: 1.0,
        priority: 1,
    },
    iceCave: {
        position: [0, 3, 0],
        radius: 15.0,
        resolution: 256,
        updateMode: 'static',
        intensity: 1.2,
    },
    volcanoZone: {
        position: [0, 8, 0],
        radius: 25.0,
        resolution: 128,
        updateMode: 'static',
        intensity: 0.8,
    },
    arena: {
        position: [0, 10, 0],
        radius: 30.0,
        resolution: 128,
        updateMode: 'realtime',
        updateInterval: 2.0,
        intensity: 1.0,
    },
};

// ---------------------------------------------------------------------------
// Wear Simulation Rates (from src/visuals/agent4/wear/config.ts)
// ---------------------------------------------------------------------------

export const wearSimulationDefaults = {
    wearPerContact: 0.001,
    dirtAccumulationRate: 0.0001,
    polishPerContact: 0.002,
    skidIntensityMultiplier: 0.1,
    heatPerContact: 0.05,
    heatDissipationRate: 0.02,
    maxWearThreshold: 1.0,
};

// ---------------------------------------------------------------------------
// Post-Process Presets (from src/visuals/agent3/effects/post-process.ts)
// ---------------------------------------------------------------------------

export const postProcessPresets = {
    quantum: {
        bloomIntensity: 1.5,
        bloomThreshold: 0.35,
        bloomRadius: 0.85,
        bloomIterations: 5,
        dofFocusDistance: 8.0,
        dofFocusRange: 4.0,
        vignetteIntensity: 0.35,
        vignetteColor: [0.05, 0.02, 0.1],
    },
    prismatic: {
        chromaticAberrationIntensity: 0.025,
        saturation: 1.25,
        bokehIntensity: 0.8,
    },
    volcanic: {
        bloomIntensity: 3.0,
        bloomRadius: 1.2,
        bloomIterations: 6,
        heatDistortionStrength: 0.05,
        filmGrainIntensity: 0.12,
        filmGrainColorized: true,
    },
    retroFilm: {
        contrast: 1.3,
        saturation: 0.75,
        tint: [0.95, 0.9, 0.8],
        vignetteIntensity: 0.6,
    },
    neon: {
        bloomIntensity: 2.0,
        bloomThreshold: 0.4,
        bloomIterations: 4,
        saturation: 1.4,
        contrast: 1.1,
    },
};

// ---------------------------------------------------------------------------
// Performance Profiles (from src/visuals/agent3/performance.ts)
// ---------------------------------------------------------------------------

export const performanceProfiles = {
    mobile: {
        maxParticles: 100,
        bloomIterations: 3,
        sssSamples: 8,
        dofQuality: 'low',
        aoSamples: 8,
        useHeatDistortion: false,
    },
    desktop: {
        maxParticles: 300,
        bloomIterations: 5,
        sssSamples: 16,
        dofQuality: 'high',
        aoSamples: 16,
        useHeatDistortion: true,
    },
    ultra: {
        maxParticles: 500,
        bloomIterations: 7,
        sssSamples: 24,
        dofQuality: 'ultra',
        aoSamples: 32,
        useHeatDistortion: true,
    },
};
