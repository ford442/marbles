/**
 * Enhanced Material System for Marbles
 * Provides texture generation and material creation with bump/normal mapping
 */

// Procedural texture generation using canvas
export function generateProceduralTexture(type, size = 256) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(size, size)
    const data = imageData.data
    
    switch(type) {
        case 'noise_normal':
            // Generate normal map from noise
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4
                    const nx = (Math.random() - 0.5) * 2
                    const ny = (Math.random() - 0.5) * 2
                    const nz = 1.0
                    const len = Math.sqrt(nx*nx + ny*ny + nz*nz)
                    
                    data[i] = ((nx / len) + 1) * 127.5     // R
                    data[i + 1] = ((ny / len) + 1) * 127.5 // G
                    data[i + 2] = ((nz / len) + 1) * 127.5 // B
                    data[i + 3] = 255                       // A
                }
            }
            break
            
        case 'bump_rough':
            // Rough surface bump map
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4
                    // Multi-octave noise simulation
                    let noise = 0
                    noise += Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5
                    noise += Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.25
                    noise += Math.random() * 0.1
                    const val = Math.floor((noise + 0.5) * 255)
                    
                    data[i] = val
                    data[i + 1] = val
                    data[i + 2] = val
                    data[i + 3] = 255
                }
            }
            break
            
        case 'marble_pattern':
            // Marble vein pattern
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4
                    const u = x / size
                    const v = y / size
                    
                    // Marble vein noise
                    let pattern = Math.sin(u * 10 + Math.sin(v * 20) * 2)
                    pattern += Math.sin(v * 15 + Math.sin(u * 25) * 1.5) * 0.5
                    pattern = (pattern + 1.5) / 3
                    
                    const val = Math.floor(pattern * 255)
                    data[i] = val
                    data[i + 1] = val
                    data[i + 2] = val
                    data[i + 3] = 255
                }
            }
            break
            
        case 'roughness':
            // Roughness map with variation
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4
                    const noise = Math.random() * 0.2 + 0.4 // Base roughness 0.4-0.6
                    const val = Math.floor(noise * 255)
                    data[i] = val
                    data[i + 1] = val
                    data[i + 2] = val
                    data[i + 3] = 255
                }
            }
            break
            
        case 'ao':
            // Ambient occlusion approximation
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4
                    const u = x / size - 0.5
                    const v = y / size - 0.5
                    const dist = Math.sqrt(u*u + v*v)
                    const ao = 1.0 - dist * 0.5
                    const val = Math.floor(ao * 255)
                    data[i] = val
                    data[i + 1] = val
                    data[i + 2] = val
                    data[i + 3] = 255
                }
            }
            break
    }
    
    ctx.putImageData(imageData, 0, 0)
    return canvas
}

import {
    marbleMaterialPresets,
    trackSurfacePresets,
    zoneSurfaceMapping
} from './material-presets.js'

// Legacy material presets with PBR properties
export const materialPresets = {
    polishedMarble: {
        roughness: 0.04,
        metallic: 0.0,
        reflectance: 0.85,
        clearCoat: 0.4,
        clearCoatRoughness: 0.05,
        bumpScale: 0.015,
        bumpFrequency: 60.0
    },
    roughConcrete: {
        roughness: 0.85,
        metallic: 0.0,
        reflectance: 0.18,
        clearCoat: 0.0,
        clearCoatRoughness: 1.0,
        bumpScale: 0.12,
        bumpFrequency: 25.0
    },
    shinyMetal: {
        roughness: 0.15,
        metallic: 1.0,
        reflectance: 1.0,
        clearCoat: 0.0,
        clearCoatRoughness: 0.0,
        bumpScale: 0.03,
        bumpFrequency: 40.0
    },
    woodenFloor: {
        roughness: 0.6,
        metallic: 0.0,
        reflectance: 0.28,
        clearCoat: 0.08,
        clearCoatRoughness: 0.4,
        bumpScale: 0.08,
        bumpFrequency: 15.0
    },
    glass: {
        roughness: 0.0,
        metallic: 0.0,
        reflectance: 1.0,
        clearCoat: 1.0,
        clearCoatRoughness: 0.0,
        bumpScale: 0.0,
        bumpFrequency: 0.0
    },
    // Salvaged experimental presets
    classicGlass: marbleMaterialPresets.classicGlass,
    obsidianMetal: marbleMaterialPresets.obsidianMetal,
    neonGlow: marbleMaterialPresets.neonGlow,
    stoneVein: marbleMaterialPresets.stoneVein,
    quantumCrystal: marbleMaterialPresets.quantumCrystal,
    volcanicMagma: marbleMaterialPresets.volcanicMagma,
    shadowNinja: marbleMaterialPresets.shadowNinja,
    galacticCore: marbleMaterialPresets.galacticCore,
}

export { marbleMaterialPresets, trackSurfacePresets, zoneSurfaceMapping }

// Helper: resolve a track surface preset by zone type
export function getTrackSurfacePreset(zoneType) {
    const key = zoneSurfaceMapping[zoneType]
    if (!key) return null
    return trackSurfacePresets[key] || null
}

// Create a texture from canvas for Filament
export async function createFilamentTexture(engine, canvas) {
    // Convert canvas to blob then to array buffer
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const arrayBuffer = await blob.arrayBuffer()
    
    // Create Filament texture (requires KTX2 or PNG parsing)
    // Note: This is a simplified version - full implementation would use
    // Filament's Texture.Builder with proper format
    return {
        data: new Uint8Array(arrayBuffer),
        width: canvas.width,
        height: canvas.height
    }
}

// Enhanced material creation with surface detail
export function createEnhancedMaterialInstance(material, Filament, type = 'polishedMarble', baseColor = [1, 1, 1]) {
    const preset = materialPresets[type] || materialPresets.polishedMarble
    const instance = material.createInstance()
    
    // Set base PBR parameters
    instance.setColor3Parameter('baseColor', Filament.RgbType.sRGB, baseColor)
    instance.setFloatParameter('roughness', preset.roughness)
    instance.setFloatParameter('metallic', preset.metallic)
    instance.setFloatParameter('reflectance', preset.reflectance)
    
    // Set clear coat for polished look
    if (preset.clearCoat > 0) {
        instance.setFloatParameter('clearCoat', preset.clearCoat)
        instance.setFloatParameter('clearCoatRoughness', preset.clearCoatRoughness)
    }
    
    return { instance, preset }
}

// Advanced material creation using experimental preset data.
// Applies all parameters supported by the current procedural material,
// and stores extra preset metadata on the returned object for future use.
export function createThemedMaterialInstance(material, Filament, presetName, baseColor = [1, 1, 1], hasProcedural = false) {
    const preset = materialPresets[presetName] || materialPresets.polishedMarble
    const instance = material.createInstance()

    // Base color — allow preset override if available
    const color = preset.color || baseColor
    instance.setColor3Parameter('baseColor', Filament.RgbType.sRGB, color)

    // roughness is safe on both baked_color.filmat and baked_procedural.filament
    instance.setFloatParameter('roughness', preset.roughness !== undefined ? preset.roughness : 0.4)

    if (hasProcedural) {
        // These parameters only exist in baked_procedural.filament
        instance.setFloatParameter('metallic', preset.metallic !== undefined ? preset.metallic : 0.0)
        instance.setFloatParameter('reflectance', preset.reflectance !== undefined ? preset.reflectance : 0.5)
        instance.setFloatParameter('clearCoat', preset.clearCoat !== undefined ? preset.clearCoat : 0.0)
        instance.setFloatParameter('clearCoatRoughness', preset.clearCoatRoughness !== undefined ? preset.clearCoatRoughness : 0.0)
        instance.setFloatParameter('bumpScale', preset.bumpScale !== undefined ? preset.bumpScale : 0.02)
        instance.setFloatParameter('bumpFrequency', preset.bumpFrequency !== undefined ? preset.bumpFrequency : 50.0)

        // Emissive — self-illuminated marbles for bloom effects (Procedural material only)
        if (preset.emissive !== undefined) {
            instance.setColor3Parameter('emissive', Filament.RgbType.LINEAR, preset.emissive)
        }
        if (preset.emissiveIntensity !== undefined) {
            instance.setFloatParameter('emissiveIntensity', preset.emissiveIntensity)
        }

        // Glass refraction & caustics (Procedural material only)
        if (preset.refractionMode !== undefined) {
            instance.setFloatParameter('refractionMode', preset.refractionMode)
        }
        if (preset.thickness !== undefined) {
            instance.setFloatParameter('thickness', preset.thickness)
        }
        if (preset.causticIntensity !== undefined) {
            instance.setFloatParameter('causticIntensity', preset.causticIntensity)
        }
        if (preset.chromaticDispersion !== undefined) {
            instance.setFloatParameter('chromaticDispersion', preset.chromaticDispersion)
        }
        if (preset.fresnelStrength !== undefined) {
            instance.setFloatParameter('fresnelStrength', preset.fresnelStrength)
        }
    }

    return { instance, preset }
}

/**
 * Apply a full surface/track preset to an existing material instance.
 * Only parameters actually supported by baked_procedural.filament are sent;
 * the hasProcedural flag guards the advanced parameters so this is safe to
 * call on the fallback baked_color.filmat as well.
 *
 * @param {object} matInstance  - Filament MaterialInstance
 * @param {object} preset       - A trackSurfacePreset or marbleMaterialPreset object
 * @param {boolean} hasProcedural - true when baked_procedural.filament loaded successfully
 * @param {object} Filament     - The Filament module (for RgbType)
 */
export function applyFullPreset(matInstance, preset, hasProcedural, Filament) {
    if (!matInstance || !preset) return

    // baseColor from surface preset uses `baseColor`; marble presets use `color`
    const color = preset.baseColor || preset.color
    if (color) {
        matInstance.setColor3Parameter('baseColor', Filament.RgbType.sRGB, color)
    }

    // roughness exists on both materials
    if (preset.roughness !== undefined) {
        matInstance.setFloatParameter('roughness', preset.roughness)
    }

    if (hasProcedural) {
        if (preset.metallic !== undefined) {
            matInstance.setFloatParameter('metallic', preset.metallic)
        }
        if (preset.reflectance !== undefined) {
            matInstance.setFloatParameter('reflectance', preset.reflectance)
        }
        if (preset.clearCoat !== undefined) {
            matInstance.setFloatParameter('clearCoat', preset.clearCoat)
        }
        if (preset.clearCoatRoughness !== undefined) {
            matInstance.setFloatParameter('clearCoatRoughness', preset.clearCoatRoughness)
        }
        if (preset.bumpScale !== undefined) {
            matInstance.setFloatParameter('bumpScale', preset.bumpScale)
        }
        if (preset.bumpFrequency !== undefined) {
            matInstance.setFloatParameter('bumpFrequency', preset.bumpFrequency)
        }

        // Emissive — self-illuminated marbles for bloom effects
        if (preset.emissive !== undefined) {
            try {
                matInstance.setColor3Parameter('emissive', Filament.RgbType.LINEAR, preset.emissive)
            } catch (e) { console.debug('[MAT] emissive not available in this material version:', e.message) }
        }
        if (preset.emissiveIntensity !== undefined) {
            try {
                matInstance.setFloatParameter('emissiveIntensity', preset.emissiveIntensity)
            } catch (e) { console.debug('[MAT] emissiveIntensity not available in this material version:', e.message) }
        }

        // Glass refraction & caustics
        if (preset.refractionMode !== undefined) {
            try {
                matInstance.setFloatParameter('refractionMode', preset.refractionMode)
            } catch (e) { console.debug('[MAT] refractionMode not available in this material version:', e.message) }
        }
        if (preset.thickness !== undefined) {
            try {
                matInstance.setFloatParameter('thickness', preset.thickness)
            } catch (e) { console.debug('[MAT] thickness not available in this material version:', e.message) }
        }
        if (preset.causticIntensity !== undefined) {
            try {
                matInstance.setFloatParameter('causticIntensity', preset.causticIntensity)
            } catch (e) { console.debug('[MAT] causticIntensity not available in this material version:', e.message) }
        }
        if (preset.chromaticDispersion !== undefined) {
            try {
                matInstance.setFloatParameter('chromaticDispersion', preset.chromaticDispersion)
            } catch (e) { console.debug('[MAT] chromaticDispersion not available in this material version:', e.message) }
        }
        if (preset.fresnelStrength !== undefined) {
            try {
                matInstance.setFloatParameter('fresnelStrength', preset.fresnelStrength)
            } catch (e) { console.debug('[MAT] fresnelStrength not available in this material version:', e.message) }
        }

        // IBL / specular parameters — wired from material-presets.js / material-variants.js.
        // These are optional parameters; use try/catch per-parameter since older material
        // versions may not expose all three uniforms.
        if (preset.clearCoatIor !== undefined) {
            try {
                matInstance.setFloatParameter('clearCoatIor', preset.clearCoatIor)
            } catch (e) { console.debug('[MAT] clearCoatIor not available in this material version:', e.message) }
        }
        if (preset.environmentIntensity !== undefined) {
            try {
                matInstance.setFloatParameter('environmentIntensity', preset.environmentIntensity)
            } catch (e) { console.debug('[MAT] environmentIntensity not available in this material version:', e.message) }
        }
        if (preset.reflectionStrength !== undefined) {
            try {
                matInstance.setFloatParameter('reflectionStrength', preset.reflectionStrength)
            } catch (e) { console.debug('[MAT] reflectionStrength not available in this material version:', e.message) }
        }

        // Tiered surface detail uniforms (procedural marble shader)
        const detailUniforms = [
            'bumpOctaves', 'surfaceType', 'subsurfaceStrength', 'anisotropyStrength',
            'grainScale', 'scratchesIntensity', 'iridescenceScale', 'effectTime',
            'sparkleStrength', 'heatShimmer',
        ]
        for (const key of detailUniforms) {
            if (preset[key] !== undefined) {
                try {
                    matInstance.setFloatParameter(key, preset[key])
                } catch (e) { console.debug(`[MAT] ${key} not available:`, e.message) }
            }
        }
    }
}

// Noise function for procedural bump (GLSL-compatible)
export const noiseFunctions = `
// Simplex noise functions for procedural bump
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                           + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                           dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}
`;

export default {
    generateProceduralTexture,
    materialPresets,
    createFilamentTexture,
    createEnhancedMaterialInstance,
    applyFullPreset,
    noiseFunctions
}
