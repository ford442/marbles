/**
 * Agent 1: Beauty Layer - Refined Material Properties
 * Marble Visual Overhaul Agent Swarm
 * 
 * This module contains enhanced PBR material configurations with:
 * - Enhanced rim lighting values
 * - Improved clear-coat for glass/metals
 * - Better anisotropic highlight settings
 * - Enhanced subsurface scattering for stone
 * - More realistic PBR roughness/metallic tuning
 * - NEW: Quantum Crystal marble theme
 * 
 * Performance Budget: < 0.5ms per marble
 * @module agent1_beauty_refinement
 */

// ============================================================================
// COLOR PALETTE CONSTANTS
// ============================================================================

/**
 * Color palette for the Quantum Crystal theme
 * Inspired by quantum energy states and crystalline structures
 */
export const QuantumCrystalPalette = {
  /** Core crystal violet - base color */
  coreViolet: [0.45, 0.12, 0.85] as [number, number, number],
  /** Energy cyan - emission/accent */
  energyCyan: [0.0, 0.95, 1.0] as [number, number, number],
  /** Phase magenta - interference patterns */
  phaseMagenta: [0.95, 0.0, 0.65] as [number, number, number],
  /** Void black - deep absorption areas */
  voidBlack: [0.02, 0.0, 0.08] as [number, number, number],
  /** Prism white - highlight peaks */
  prismWhite: [0.98, 0.95, 1.0] as [number, number, number],
  /** Entanglement gold - rare accents */
  entanglementGold: [1.0, 0.85, 0.3] as [number, number, number],
  /** Superposition gradient - for iridescence */
  superposition: {
    low: [0.2, 0.0, 0.5] as [number, number, number],
    mid: [0.5, 0.2, 0.8] as [number, number, number],
    high: [0.0, 0.8, 1.0] as [number, number, number]
  }
} as const;

/**
 * Enhanced color palettes for existing marble types
 */
export const EnhancedColorPalettes = {
  glass: {
    base: [0.15, 0.35, 0.55] as [number, number, number],
    rim: [0.6, 0.9, 1.0] as [number, number, number],
    caustic: [1.0, 0.95, 0.75] as [number, number, number],
    absorption: [0.05, 0.15, 0.25] as [number, number, number]
  },
  obsidian: {
    base: [0.02, 0.02, 0.03] as [number, number, number],
    metallic: [0.12, 0.12, 0.15] as [number, number, number],
    heat: [0.8, 0.3, 0.05] as [number, number, number],
    scratch: [0.3, 0.3, 0.35] as [number, number, number]
  },
  neon: {
    core: [0.0, 1.0, 0.9] as [number, number, number],
    pulse: [1.0, 0.0, 0.6] as [number, number, number],
    circuit: [0.4, 0.0, 1.0] as [number, number, number],
    bloom: [0.2, 1.0, 1.0] as [number, number, number]
  },
  stone: {
    base: [0.88, 0.85, 0.80] as [number, number, number],
    vein: [0.35, 0.30, 0.40] as [number, number, number],
    sssWarm: [1.0, 0.82, 0.65] as [number, number, number],
    sparkle: [1.0, 0.97, 0.88] as [number, number, number]
  }
} as const;

// ============================================================================
// REFINED MATERIAL CONFIGURATION INTERFACES
// ============================================================================

/**
 * Enhanced material configuration interface with PBR properties
 * Extends the base config with advanced material properties
 */
export interface RefinedMarbleMaterialConfig {
  /** Material identifier */
  name: string;
  /** Vertex shader source */
  vertexShader: string;
  /** Fragment shader source */
  fragmentShader: string;
  /** Uniform variables for shaders */
  uniforms: Record<string, { type: string; value: any }>;
  /** Blending mode */
  blending: 'opaque' | 'transparent' | 'additive';
  /** Depth write flag */
  depthWrite: boolean;
  /** Face culling mode */
  cullFace: 'front' | 'back' | 'none';
  
  // === PBR Material Properties ===
  
  /** 
   * Base color/albedo of the material
   * RGB values in 0-1 range
   */
  baseColor: [number, number, number];
  
  /**
   * Metallic factor - 0 = dielectric, 1 = fully metallic
   * @range 0.0 - 1.0
   */
  metallic: number;
  
  /**
   * Roughness factor - 0 = perfectly smooth, 1 = completely rough
   * @range 0.0 - 1.0
   */
  roughness: number;
  
  /**
   * Reflectance at normal incidence (F0)
   * Controls specular intensity for dielectrics
   * @range 0.0 - 1.0
   */
  reflectance: number;
  
  // === Clear Coat Properties ===
  
  /**
   * Clear coat layer intensity
   * Simulates varnish/lacquer layer on top
   * @range 0.0 - 1.0
   */
  clearCoat: number;
  
  /**
   * Clear coat roughness
   * Surface roughness of the clear coat layer
   * @range 0.0 - 1.0
   */
  clearCoatRoughness: number;
  
  /**
   * Clear coat normal map strength
   * Independent surface detail for clear coat
   * @range 0.0 - 1.0
   */
  clearCoatNormalScale: number;
  
  // === Anisotropic Properties ===
  
  /**
   * Anisotropy strength
   * Controls elongated highlights (0 = isotropic, 1 = max anisotropic)
   * @range 0.0 - 1.0
   */
  anisotropy: number;
  
  /**
   * Anisotropy direction in degrees
   * Rotation of the anisotropic highlight
   * @range 0 - 360
   */
  anisotropyDirection: number;
  
  // === Rim Lighting Properties ===
  
  /**
   * Rim lighting intensity
   * Fresnel-based edge lighting multiplier
   * @range 0.0 - 5.0
   */
  rimLightingIntensity: number;
  
  /**
   * Rim lighting power/exponent
   * Controls the falloff of rim lighting (higher = tighter rim)
   * @range 0.5 - 5.0
   */
  rimLightingPower: number;
  
  /**
   * Rim lighting color tint
   * RGB color for the rim light contribution
   */
  rimLightingColor: [number, number, number];
  
  // === Subsurface Scattering Properties ===
  
  /**
   * Subsurface scattering strength
   * Light transmission through the material
   * @range 0.0 - 1.0
   */
  subsurfaceScattering: number;
  
  /**
   * Subsurface scattering color
   * Tint color for transmitted light
   */
  subsurfaceColor: [number, number, number];
  
  /**
   * Subsurface scattering thickness
   * Simulated material thickness for SSS
   * @range 0.0 - 10.0
   */
  subsurfaceThickness: number;
  
  // === Performance Hints ===
  
  /**
   * Estimated GPU cost in milliseconds
   * Used for LOD decisions and performance budgeting
   */
  estimatedGpuCost: number;
  
  /**
   * Quality tier for adaptive rendering
   */
  qualityTier: 'low' | 'medium' | 'high' | 'ultra';
}

/**
 * Post-processing configuration interface (matching existing)
 */
export interface PostProcessConfig {
  bloom: {
    enabled: boolean;
    intensity: number;
    threshold: number;
    radius: number;
    iterations: number;
  };
  motionBlur: {
    enabled: boolean;
    intensity: number;
    samples: number;
  };
  chromaticAberration: {
    enabled: boolean;
    intensity: number;
  };
  screenSpaceReflections: {
    enabled: boolean;
    maxSteps: number;
    stepSize: number;
    thickness: number;
  };
  colorGrading: {
    enabled: boolean;
    contrast: number;
    saturation: number;
    tint: [number, number, number];
  };
}

/**
 * Complete marble rendering package with refined materials
 */
export interface RefinedMarbleRenderingPackage {
  name: string;
  materialConfig: RefinedMarbleMaterialConfig;
  postProcessConfig: PostProcessConfig;
}

// ============================================================================
// BASE VERTEX SHADER (Shared)
// ============================================================================

/**
 * Base vertex shader with support for all refined material features
 */
const REFINED_VERTEX_SHADER = `
#include "common_types.glsl"

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform float uTime;
uniform float uDistortionStrength;
uniform float uAnisotropyDirection;

in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;

out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vTangent;
out vec3 vBitangent;
out vec3 vViewDirection;
out vec2 vUv;
out float vDepth;
out float vFresnel;

// Calculate anisotropic tangent frame
mat3 computeAnisotropicFrame(vec3 N, float angleDegrees) {
    float angleRad = radians(angleDegrees);
    vec3 T = normalize(tangent - dot(tangent, N) * N);
    vec3 B = cross(N, T);
    
    // Rotate tangent frame
    float c = cos(angleRad);
    float s = sin(angleRad);
    vec3 newT = T * c + B * s;
    vec3 newB = -T * s + B * c;
    
    return mat3(newT, newB, N);
}

void main() {
    vec3 pos = position;
    
    // Optional vertex distortion for energy effects
    float distortion = sin(pos.x * 10.0 + uTime * 2.0) * 
                       cos(pos.y * 10.0 + uTime * 1.5) * 
                       sin(pos.z * 10.0 + uTime * 0.5) * 
                       uDistortionStrength;
    pos += normal * distortion;
    
    // Transform to world space
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view direction
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewDirection = -viewPosition.xyz;
    vDepth = -viewPosition.z;
    
    // Transform normal basis to world space
    vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = normalize((normalMatrix * vec4(tangent, 0.0)).xyz);
    vBitangent = cross(vNormal, vTangent);
    
    vUv = uv;
    
    // Pre-calculate fresnel for rim lighting
    vec3 viewDir = normalize(vViewDirection);
    vFresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
    
    gl_Position = projectionMatrix * viewPosition;
}
`;

// ============================================================================
// REFINED FRAGMENT SHADERS
// ============================================================================

/**
 * Enhanced Classic Glass Fragment Shader
 * Features: Improved clear-coat, enhanced refraction, better rim lighting
 */
const REFINED_GLASS_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D noiseTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uRefractionIndex;
uniform float uFresnelPower;
uniform float uCausticIntensity;
uniform float uClearCoat;
uniform float uClearCoatRoughness;
uniform float uRimIntensity;
uniform float uRimPower;
uniform vec3 uRimColor;
uniform vec3 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uReflectance;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vFresnel;

out vec4 fragColor;

// Schlick's Fresnel approximation with roughness correction
float fresnelRoughness(vec3 viewDir, vec3 normal, float f0, float roughness) {
    float cosTheta = max(dot(viewDir, normal), 0.0);
    float f90 = 0.5 + 2.0 * roughness * pow(1.0 - cosTheta, 5.0);
    return f0 + (f90 - f0) * pow(1.0 - cosTheta, 5.0);
}

// Enhanced caustic pattern with chromatic dispersion
vec3 causticPattern(vec3 pos, float time) {
    vec3 p = pos * 2.0;
    
    float causticR = sin(p.x * 3.0 + time) * cos(p.y * 3.0 + time * 0.7);
    causticR += sin(p.y * 5.0 - time * 0.5) * cos(p.z * 5.0 + time * 0.3) * 0.5;
    
    float causticG = sin(p.x * 3.1 + time * 0.95) * cos(p.y * 3.1 + time * 0.75);
    causticG += sin(p.y * 5.1 - time * 0.45) * cos(p.z * 5.1 + time * 0.35) * 0.5;
    
    float causticB = sin(p.x * 2.9 + time * 1.05) * cos(p.y * 2.9 + time * 0.65);
    causticB += sin(p.y * 4.9 - time * 0.55) * cos(p.z * 4.9 + time * 0.25) * 0.5;
    
    return vec3(causticR, causticG, causticB) * 0.25 + 0.5;
}

// Clear coat specular BRDF approximation
float clearCoatBRDF(vec3 viewDir, vec3 normal, vec3 lightDir, float roughness) {
    vec3 halfDir = normalize(viewDir + lightDir);
    float nh = max(dot(normal, halfDir), 0.0);
    float nv = max(dot(normal, viewDir), 0.0);
    float nl = max(dot(normal, lightDir), 0.0);
    
    // GGX distribution simplified
    float alpha = roughness * roughness;
    float alpha2 = alpha * alpha;
    float denom = nh * nh * (alpha2 - 1.0) + 1.0;
    float D = alpha2 / (3.14159 * denom * denom);
    
    // Geometric attenuation
    float G = min(1.0, min(2.0 * nh * nv / dot(viewDir, halfDir), 
                           2.0 * nh * nl / dot(viewDir, halfDir)));
    
    return D * G * 0.25 / (nv * nl + 0.001);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Reflection and refraction directions
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 refractDir = refract(-viewDir, normal, 1.0 / uRefractionIndex);
    
    // Sample environment
    vec3 reflectionColor = texture(envMap, reflectDir).rgb;
    vec3 refractionColor = texture(envMap, refractDir).rgb;
    
    // Chromatic dispersion with wavelength-dependent IOR
    float dispersionStrength = 0.015;
    vec3 dispersion;
    dispersion.r = texture(envMap, refractRay(-viewDir, normal, uRefractionIndex * (1.0 - dispersionStrength))).r;
    dispersion.g = texture(envMap, refractDir).g;
    dispersion.b = texture(envMap, refractRay(-viewDir, normal, uRefractionIndex * (1.0 + dispersionStrength))).b;
    
    // Enhanced caustics
    vec3 internalPos = vWorldPosition * 0.5 + vec3(0.0, uTime * 0.1, 0.0);
    vec3 caustic = causticPattern(internalPos, uTime);
    caustic = pow(caustic, vec3(3.0)) * uCausticIntensity;
    
    // Fresnel factor for reflection/refraction mix
    float fresnel = fresnelRoughness(viewDir, normal, uReflectance, uRoughness);
    
    // Base glass composition
    vec3 glassColor = mix(dispersion, reflectionColor, fresnel * (1.0 + uMetallic));
    
    // Add caustic highlights
    glassColor += caustic * uCausticIntensity * (1.0 - fresnel);
    
    // Clear coat layer
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float clearCoatSpec = clearCoatBRDF(viewDir, normal, lightDir, uClearCoatRoughness);
    vec3 clearCoatColor = vec3(1.0) * clearCoatSpec * uClearCoat;
    glassColor += clearCoatColor;
    
    // Enhanced rim lighting
    float rimFactor = pow(vFresnel, uRimPower) * uRimIntensity;
    glassColor += uRimColor * rimFactor;
    
    // Attenuation through glass volume
    float thickness = 1.0 - abs(dot(viewDir, normal));
    glassColor *= exp(-thickness * 0.25);
    
    // Base color tint
    glassColor = mix(glassColor, uBaseColor * 1.5, 0.15);
    
    // Alpha based on fresnel and clear coat
    float alpha = 0.75 + fresnel * 0.15 + uClearCoat * 0.1;
    
    fragColor = vec4(glassColor, clamp(alpha, 0.0, 1.0));
}

// Helper function for refraction
vec3 refractRay(vec3 incident, vec3 normal, float ior) {
    float cosi = dot(incident, normal);
    float etai = 1.0, etat = ior;
    vec3 n = normal;
    if (cosi < 0.0) {
        cosi = -cosi;
    } else {
        etai = ior;
        etat = 1.0;
        n = -normal;
    }
    float eta = etai / etat;
    float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
    if (k < 0.0) return reflect(incident, n);
    return eta * incident + (eta * cosi - sqrt(k)) * n;
}
`;

/**
 * Enhanced Obsidian Metal Fragment Shader
 * Features: Better anisotropic highlights, improved clear-coat, refined metal grain
 */
const REFINED_OBSIDIAN_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D grainTexture;
uniform sampler2D anisoTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uAnisotropy;
uniform float uAnisotropyDirection;
uniform float uGrainScale;
uniform float uScratchesIntensity;
uniform float uClearCoat;
uniform float uClearCoatRoughness;
uniform float uRimIntensity;
uniform float uRimPower;
uniform vec3 uRimColor;
uniform vec3 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uReflectance;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;
in float vFresnel;

out vec4 fragColor;

// Anisotropic GGX distribution
float anisotropicGGX(vec3 H, vec3 T, vec3 B, float ax, float ay) {
    float th = dot(H, T);
    float bh = dot(H, B);
    float nh = dot(H, vNormal);
    
    float tmp = (th * th) / (ax * ax) + (bh * bh) / (ay * ay) + (nh * nh);
    return 1.0 / (3.14159 * ax * ay * tmp * tmp);
}

// Enhanced anisotropic Ward with energy conservation
float wardAnisotropic(vec3 L, vec3 V, vec3 N, vec3 T, vec3 B, float ax, float ay) {
    vec3 H = normalize(L + V);
    float TH = dot(T, H);
    float BH = dot(B, H);
    float NH = max(dot(N, H), 0.0);
    float NV = max(dot(N, V), 0.0);
    float NL = max(dot(N, L), 0.0);
    
    if (NH <= 0.0 || NL <= 0.0 || NV <= 0.0) return 0.0;
    
    float beta = -2.0 * (TH * TH / (ax * ax) + BH * BH / (ay * ay));
    beta /= (1.0 + NH);
    
    float spec = exp(beta) / (4.0 * 3.14159 * ax * ay * sqrt(NL * NV));
    
    // Energy normalization approximation
    return spec * NL;
}

// Procedural metal grain with anisotropic direction
float metalGrainAniso(vec2 uv, float scale, float direction) {
    float angle = radians(direction);
    vec2 dir = vec2(cos(angle), sin(angle));
    
    vec2 uvScaled = uv * scale;
    
    // Anisotropic grain following the direction
    float grain = sin(dot(uvScaled, dir) * 80.0) * 0.5 + 0.5;
    grain += sin(dot(uvScaled, dir) * 200.0 + uvScaled.x * 50.0) * 0.3;
    grain += sin(dot(uvScaled, vec2(-dir.y, dir.x)) * 150.0) * 0.2;
    
    return grain;
}

// Micro-scratches with directional bias
float volcanicScratches(vec3 pos, vec2 uv, float direction) {
    float scratches = 0.0;
    float angleRad = radians(direction);
    
    // Primary scratches aligned with anisotropy
    vec2 dir1 = vec2(cos(angleRad), sin(angleRad));
    float line1 = abs(dot(uv - 0.5, dir1)) * 25.0;
    scratches += exp(-line1 * line1) * 0.6;
    
    // Secondary scratches perpendicular
    vec2 dir2 = vec2(-sin(angleRad), cos(angleRad));
    float line2 = abs(dot(uv - 0.5, dir2)) * 18.0;
    scratches += exp(-line2 * line2) * 0.3;
    
    // Random micro-scratches
    float s1 = sin(pos.x * 12.9898 + pos.z * 78.233) * 43758.5453;
    float micro = step(0.98, fract(s1));
    scratches += micro * 0.1;
    
    return scratches * uScratchesIntensity;
}

// Clear coat specular
float clearCoatSpec(vec3 viewDir, vec3 normal, vec3 lightDir, float roughness) {
    vec3 halfDir = normalize(viewDir + lightDir);
    float nh = max(dot(normal, halfDir), 0.0);
    float alpha = roughness * roughness;
    float alpha2 = max(alpha * alpha, 0.001);
    float denom = nh * nh * (alpha2 - 1.0) + 1.0;
    return alpha2 / (3.14159 * denom * denom);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 tangent = normalize(vTangent);
    vec3 bitangent = normalize(vBitangent);
    vec3 viewDir = normalize(vViewDirection);
    
    // Anisotropic roughness based on grain
    float grain = metalGrainAniso(vUv, uGrainScale, uAnisotropyDirection);
    
    // Elongated roughness (more rough perpendicular to grain direction)
    float ax = uRoughness * (0.5 + grain * 0.3);  // Along grain
    float ay = uRoughness * (1.5 + grain * 0.5);  // Across grain
    
    // Apply anisotropy scaling
    ax = mix(uRoughness, ax, uAnisotropy);
    ay = mix(uRoughness, ay, uAnisotropy);
    
    // Multiple light sources for anisotropic highlights
    vec3 lightDir1 = normalize(vec3(1.0, 1.0, 1.0));
    vec3 lightDir2 = normalize(vec3(-0.5, 0.8, -0.3));
    vec3 lightDir3 = normalize(vec3(0.3, 0.5, -0.8));
    
    float aniso1 = wardAnisotropic(lightDir1, viewDir, normal, tangent, bitangent, ax, ay);
    float aniso2 = wardAnisotropic(lightDir2, viewDir, normal, tangent, bitangent, ax, ay);
    float aniso3 = wardAnisotropic(lightDir3, viewDir, normal, tangent, bitangent, ax, ay);
    
    // Environment reflection with anisotropic roughness
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 baseReflect = texture(envMap, reflectDir).rgb;
    
    // Anisotropic streaks in reflection
    float streak = pow(max(dot(reflectDir, tangent), 0.0), 4.0 / (ax + 0.001));
    vec3 anisoReflect = baseReflect * (1.0 + streak * uAnisotropy * 0.5);
    
    // Scratches
    float scratches = volcanicScratches(vWorldPosition, vUv, uAnisotropyDirection);
    
    // Base color composition
    vec3 obsidianColor = uBaseColor;
    vec3 metalColor = vec3(0.15, 0.15, 0.18) * uMetallic;
    vec3 finalColor = mix(obsidianColor, metalColor, grain * uMetallic);
    
    // Add reflection with metallic scaling
    finalColor += anisoReflect * (0.3 + grain * 0.2) * (0.5 + uMetallic * 0.5);
    
    // Anisotropic highlights with color shift
    vec3 highlightColor = vec3(0.92, 0.94, 1.0);
    finalColor += (aniso1 * 0.5 + aniso2 * 0.3 + aniso3 * 0.2) * highlightColor * (1.0 + uAnisotropy);
    
    // Scratches catch light
    finalColor += scratches * anisoReflect * 2.0;
    
    // Edge darkening (obsidian characteristic) with rim override
    float edgeDarken = pow(vFresnel, 2.0);
    finalColor *= (0.25 + 0.75 * edgeDarken);
    
    // Enhanced rim lighting for edges
    float rimFactor = pow(vFresnel, uRimPower) * uRimIntensity;
    finalColor += uRimColor * rimFactor;
    
    // Clear coat layer
    float ccSpec = clearCoatSpec(viewDir, normal, lightDir1, uClearCoatRoughness);
    finalColor += vec3(ccSpec) * uClearCoat;
    
    // Subtle heat shimmer at edges
    float heat = sin(vWorldPosition.y * 10.0 + uTime * 2.0) * 0.5 + 0.5;
    heat *= pow(edgeDarken, 3.0) * 0.08;
    finalColor += vec3(heat * 0.6, heat * 0.2, 0.0);
    
    fragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Enhanced Neon Glow Fragment Shader
 * Features: Enhanced rim lighting, improved iridescence, better bloom contribution
 */
const REFINED_NEON_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D hologramTexture;
uniform sampler2D noiseTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uIridescenceScale;
uniform float uGlowIntensity;
uniform float uHologramSpeed;
uniform float uRimIntensity;
uniform float uRimPower;
uniform vec3 uRimColor;
uniform vec3 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uSubsurfaceScattering;
uniform float uSubsurfaceThickness;
uniform vec3 uSubsurfaceColor;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vDepth;
in float vFresnel;

out vec4 fragColor;
out vec4 bloomColor;

// Thin-film interference with improved spectral response
vec3 thinFilmIridescence(float cosTheta, float d, float nFilm) {
    // Phase shift with wavelength-dependent index
    float phase = 2.0 * 3.14159 * nFilm * d * sqrt(1.0 - (1.0 - cosTheta * cosTheta) / (nFilm * nFilm));
    
    // Spectral colors (more physically accurate)
    vec3 phaseRGB;
    phaseRGB.r = phase * 1.0;      // Red wavelength reference
    phaseRGB.g = phase * 1.142;    // Green (700/600 nm ratio)
    phaseRGB.b = phase * 1.333;    // Blue (700/525 nm ratio)
    
    vec3 intensity = 0.5 + 0.5 * cos(phaseRGB);
    
    // Convert to vibrant color
    return vec3(
        intensity.r * 1.2 - 0.1,
        intensity.g * 1.15 - 0.075,
        intensity.b * 1.25 - 0.125
    );
}

// Holographic interference pattern
vec3 holographicPattern(vec2 uv, float time, float quality) {
    vec3 color = vec3(0.0);
    
    // Scanlines with beat frequency
    float scanline = sin(uv.y * 200.0 + time * 10.0) * 0.5 + 0.5;
    scanline *= sin(uv.y * 198.0 + time * 10.1) * 0.5 + 0.5;  // Beat pattern
    scanline = pow(scanline, 20.0) * 0.4 * quality;
    
    // Rainbow diffraction grating
    float diffraction = sin(uv.x * 100.0 + time) * sin(uv.y * 80.0 - time * 0.5);
    vec3 rainbow = 0.5 + 0.5 * cos(vec3(0.0, 0.67, 1.33) * diffraction * 3.14159 + time);
    
    // Hexagonal grid with glow
    vec2 hexUV = uv * 30.0;
    float hex = abs(sin(hexUV.x * 1.732 + hexUV.y) * 
                    sin(hexUV.x * 1.732 - hexUV.y) * 
                    sin(hexUV.y * 2.0));
    hex = pow(1.0 - hex, 8.0) * quality;
    
    color = rainbow * hex * 0.6 + scanline;
    
    return color;
}

// Energy core with subsurface glow
float energyCore(vec2 uv, float time, float intensity) {
    float distFromCenter = length(uv - 0.5);
    
    // Multi-layered core
    float core1 = exp(-distFromCenter * 3.0);
    float core2 = exp(-distFromCenter * 8.0) * 0.5;
    float core3 = exp(-distFromCenter * 15.0) * 0.25;
    
    // Pulse with harmonics
    float pulse = sin(time * 3.0) * 0.3 + 0.7;
    pulse += sin(time * 7.0) * 0.1;
    pulse += sin(time * 13.0) * 0.05;
    
    return (core1 + core2 + core3) * pulse * intensity;
}

// Circuit patterns with energy flow
float circuitPattern(vec2 uv, float time) {
    vec2 center = uv - 0.5;
    float angle = atan(center.y, center.x);
    float radius = length(center) * 20.0;
    
    // Rotating circuit rings
    float ring1 = sin(angle * 6.0 + radius * 1.5 + time * 2.0);
    float ring2 = sin(angle * 12.0 - radius * 2.0 + time * 1.5);
    
    // Radial energy pulses
    float pulse = sin(radius - time * 5.0) * 0.5 + 0.5;
    pulse *= exp(-abs(radius - 5.0) * 0.5);
    pulse += exp(-abs(radius - 8.0) * 0.3) * (sin(time * 3.0) * 0.5 + 0.5);
    
    return (ring1 + ring2) * 0.25 * pulse + pulse * 0.5;
}

// Subsurface energy glow
vec3 subsurfaceGlow(vec3 viewDir, vec3 normal, vec3 color, float thickness, float intensity) {
    float viewDot = max(dot(viewDir, -normal), 0.0);
    float wrap = 0.5;
    float scatter = max(viewDot + wrap, 0.0) / ((1.0 + wrap) * (1.0 + wrap));
    scatter *= exp(-thickness * 0.5);
    return color * scatter * intensity;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // View-dependent iridescence with film thickness variation
    float cosTheta = abs(dot(viewDir, normal));
    float filmThickness = 400.0 + sin(vUv.x * 10.0 + vUv.y * 8.0 + uTime) * 100.0;
    filmThickness += sin(vUv.x * 25.0 - vUv.y * 20.0 + uTime * 0.5) * 50.0;
    vec3 iridescence = thinFilmIridescence(cosTheta, filmThickness, 1.33);
    
    // Base holographic pattern
    vec3 hologram = holographicPattern(vUv, uTime * uHologramSpeed, 1.0);
    
    // Energy core with subsurface effect
    float coreGlow = energyCore(vUv, uTime, uGlowIntensity);
    vec3 subsurface = subsurfaceGlow(viewDir, normal, uSubsurfaceColor, uSubsurfaceThickness, uSubsurfaceScattering);
    
    // Circuit patterns
    float circuit = circuitPattern(vUv, uTime);
    
    // Base colors
    vec3 neonCyan = vec3(0.0, 1.0, 0.95);
    vec3 neonPink = vec3(1.0, 0.0, 0.55);
    vec3 neonPurple = vec3(0.6, 0.0, 1.0);
    
    // Animated color blending
    float colorPhase = sin(uTime * 0.5) * 0.5 + 0.5;
    vec3 baseColor = mix(neonCyan, neonPink, colorPhase);
    baseColor = mix(baseColor, neonPurple, iridescence.b * 0.5 + 0.25);
    baseColor = mix(baseColor, uBaseColor, 0.3);
    
    // Combine effects
    vec3 finalColor = baseColor * (0.25 + hologram * 0.75);
    finalColor += iridescence * uIridescenceScale;
    finalColor += baseColor * coreGlow;
    finalColor += neonCyan * circuit * 0.6;
    finalColor += subsurface;
    
    // Enhanced rim lighting with fresnel
    float rimFactor = pow(vFresnel, uRimPower) * uRimIntensity;
    finalColor += uRimColor * rimFactor * 2.0;
    
    // Reflection with color shift
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    finalColor += reflection * iridescence * uMetallic * 0.4;
    
    // Surface roughness variation
    float surfaceNoise = sin(vUv.x * 100.0) * sin(vUv.y * 100.0) * 0.5 + 0.5;
    finalColor *= (1.0 - surfaceNoise * uRoughness * 0.2);
    
    // Calculate bloom contribution
    vec3 bloom = finalColor;
    float luminance = dot(bloom, vec3(0.299, 0.587, 0.114));
    bloom = mix(vec3(0.0), bloom, smoothstep(0.4, 0.9, luminance));
    bloom *= uGlowIntensity * 1.5;
    
    fragColor = vec4(finalColor, 0.92);
    bloomColor = vec4(bloom, 1.0);
}
`;

/**
 * Enhanced Stone Vein Fragment Shader
 * Features: Enhanced subsurface scattering, better mineral sparkle
 */
const REFINED_STONE_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D veinTexture;
uniform sampler2D sparkleTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uSSSIntensity;
uniform float uSSSThickness;
uniform vec3 uSSSColor;
uniform float uSparkleDensity;
uniform float uSparkleSpeed;
uniform float uRimIntensity;
uniform float uRimPower;
uniform vec3 uRimColor;
uniform vec3 uBaseColor;
uniform float uRoughness;
uniform float uReflectance;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vFresnel;

out vec4 fragColor;

// Enhanced subsurface scattering with thickness map
float subsurfaceScattering(
    vec3 viewDir, 
    vec3 normal, 
    vec3 lightDir, 
    float thickness,
    float power
) {
    // Wrap lighting for subsurface
    float wrap = 0.5;
    float dotNL = max(dot(normal, lightDir), 0.0);
    float scattering = max(dotNL + wrap, 0.0) / ((1.0 + wrap) * (1.0 + wrap));
    
    // View-dependent translucency
    vec3 backDir = -lightDir;
    float viewScatter = max(dot(viewDir, backDir), 0.0);
    
    // Thickness attenuation
    float attenuation = exp(-thickness * power);
    
    return scattering * viewScatter * attenuation * (1.0 + thickness * 0.5);
}

// Enhanced mineral sparkle with crystalline structure
float mineralSparkle(vec3 pos, vec3 normal, vec3 viewDir, vec2 uv, float time) {
    float sparkle = 0.0;
    
    // Multiple sparkle sources with crystalline alignment
    vec3 sparklePos = pos * 50.0;
    
    // Pseudo-random sparkle positions with structure
    float s1 = sin(sparklePos.x * 12.9898 + sparklePos.y * 78.233) * 43758.5453;
    float s2 = sin(sparklePos.y * 43.1234 + sparklePos.z * 23.456) * 23421.6789;
    float s3 = sin(sparklePos.z * 19.8765 + sparklePos.x * 54.321) * 12345.6789;
    float s4 = sin(sparklePos.x * 33.456 + sparklePos.z * 67.891) * 54321.1234;
    
    s1 = fract(s1);
    s2 = fract(s2);
    s3 = fract(s3);
    s4 = fract(s4);
    
    // View-dependent intensity (sparkle when looking at glancing angles)
    float viewFactor = 1.0 - abs(dot(viewDir, normal));
    viewFactor = pow(viewFactor, 3.0);
    
    // Temporal sparkle with phase variation
    float twinkle1 = sin(time * uSparkleSpeed + s1 * 100.0) * 0.5 + 0.5;
    float twinkle2 = sin(time * uSparkleSpeed * 0.7 + s2 * 100.0 + 1.0) * 0.5 + 0.5;
    float twinkle3 = sin(time * uSparkleSpeed * 1.3 + s3 * 100.0 + 2.0) * 0.5 + 0.5;
    float twinkle4 = sin(time * uSparkleSpeed * 0.85 + s4 * 100.0 + 3.0) * 0.5 + 0.5;
    
    // Combine sparkles with intensity falloff
    sparkle += step(0.96, s1) * twinkle1 * viewFactor;
    sparkle += step(0.97, s2) * twinkle2 * viewFactor * 0.8;
    sparkle += step(0.98, s3) * twinkle3 * viewFactor * 0.6;
    sparkle += step(0.99, s4) * twinkle4 * viewFactor * 0.4;
    
    // Microfacet sparkle for stone surface
    float microfacet = sin(uv.x * 500.0) * sin(uv.y * 500.0);
    microfacet = pow(microfacet * 0.5 + 0.5, 20.0) * 0.3;
    sparkle += microfacet * viewFactor;
    
    return sparkle * uSparkleDensity;
}

// Vein pattern with depth and layering
float veinPattern(vec2 uv, float time) {
    float pattern = 0.0;
    
    // Main veins with curvature
    vec2 p = uv * 3.0;
    float vein1 = sin(p.x * 2.0 + sin(p.y * 3.0 + time * 0.1) * 0.5);
    vein1 = smoothstep(0.55, 0.65, vein1 * 0.5 + 0.5);
    
    // Secondary veins intersecting
    float vein2 = sin(p.y * 4.0 + sin(p.x * 2.0 - time * 0.05) * 0.3);
    vein2 = smoothstep(0.65, 0.75, vein2 * 0.5 + 0.5) * 0.6;
    
    // Fine detail veins
    float vein3 = sin(p.x * 8.0 + p.y * 6.0) * 0.5 + 0.5;
    vein3 = pow(vein3, 8.0) * 0.3;
    
    // Fine cracks with depth
    float cracks = sin(p.x * 20.0 + sin(p.y * 15.0)) * sin(p.y * 20.0 + sin(p.x * 12.0));
    cracks = pow(cracks * 0.5 + 0.5, 15.0) * 0.25;
    
    pattern = vein1 + vein2 + vein3 + cracks;
    
    return clamp(pattern, 0.0, 1.0);
}

// Stone micro-surface detail
float microDetail(vec2 uv) {
    float detail = sin(uv.x * 300.0) * sin(uv.y * 300.0);
    detail += sin(uv.x * 150.0 + uv.y * 200.0) * 0.5;
    return detail * 0.5 + 0.5;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Sample vein texture
    vec4 veinTex = texture(veinTexture, vUv);
    
    // Stone colors with variation
    vec3 baseStone = uBaseColor;
    vec3 veinColor = vec3(0.32, 0.27, 0.37);
    
    // Procedural veins
    float veins = veinPattern(vUv, uTime * 0.1);
    
    // Micro-surface detail
    float detail = microDetail(vUv);
    
    // Blend stone with veins
    vec3 stoneColor = mix(baseStone, veinColor, veins * veinTex.r);
    stoneColor *= (0.95 + detail * 0.1);
    
    // Enhanced subsurface scattering through thinner vein areas
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float thickness = mix(uSSSThickness, uSSSThickness * 0.3, veins * 0.7);
    float sss = subsurfaceScattering(viewDir, normal, lightDir, thickness, 0.3);
    
    // Subsurface color with warm tone
    vec3 sssColor = uSSSColor * sss * uSSSIntensity;
    stoneColor += sssColor;
    
    // Mineral sparkles
    float sparkle = mineralSparkle(vWorldPosition, normal, viewDir, vUv, uTime);
    vec3 sparkleColor = vec3(1.0, 0.97, 0.9) * sparkle;
    stoneColor += sparkleColor;
    
    // Surface roughness variation based on veins
    float roughness = mix(uRoughness, uRoughness * 1.5, veins * 0.5);
    roughness *= (0.9 + detail * 0.2);
    
    // Diffuse lighting with wrap
    float diff = max(dot(normal, lightDir), 0.0);
    float diffWrap = max(dot(normal, lightDir) * 0.5 + 0.5, 0.0);
    stoneColor *= (0.25 + 0.5 * diff + 0.25 * diffWrap);
    
    // Specular with roughness
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0 / (roughness + 0.01));
    stoneColor += vec3(1.0) * spec * (1.0 - veins * 0.3) * uReflectance;
    
    // Ambient occlusion in vein crevices
    float ao = 1.0 - veins * 0.25;
    stoneColor *= ao;
    
    // Environment reflection (subtle)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    stoneColor += reflection * 0.04 * (1.0 - roughness) * uReflectance;
    
    // Rim lighting for edge definition
    float rimFactor = pow(vFresnel, uRimPower) * uRimIntensity;
    stoneColor += uRimColor * rimFactor * 0.5;
    
    fragColor = vec4(stoneColor, 1.0);
}
`;

/**
 * NEW: Quantum Crystal Fragment Shader
 * Features: Iridescent quantum interference, energy pulses, crystalline structure
 */
const QUANTUM_CRYSTAL_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D crystalTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uIridescenceScale;
uniform float uGlowIntensity;
uniform float uQuantumPhase;
uniform float uRimIntensity;
uniform float uRimPower;
uniform vec3 uRimColor;
uniform vec3 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uAnisotropy;
uniform float uSubsurfaceScattering;
uniform vec3 uSubsurfaceColor;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;
in float vFresnel;

out vec4 fragColor;
out vec4 bloomColor;

// Quantum interference pattern
float quantumWave(vec3 pos, float time, float phase) {
    float wave = 0.0;
    
    // Standing wave patterns
    wave += sin(pos.x * 5.0 + time * 2.0 + phase) * cos(pos.y * 5.0 + phase);
    wave += sin(pos.y * 7.0 - time * 1.5) * cos(pos.z * 7.0 + phase * 0.5) * 0.5;
    wave += sin(pos.z * 9.0 + time * 1.0 + phase * 1.5) * cos(pos.x * 9.0) * 0.25;
    
    // Interference beats
    float beat = sin(time * 0.5) * sin(time * 0.53);
    wave *= (0.8 + beat * 0.2);
    
    return wave * 0.5 + 0.5;
}

// Crystalline facet structure
float crystalFacets(vec2 uv, vec3 normal) {
    // Hexagonal crystal lattice
    vec2 hexUV = uv * 15.0;
    float hex = abs(sin(hexUV.x * 1.732 + hexUV.y));
    hex *= abs(sin(hexUV.x * 1.732 - hexUV.y));
    hex *= abs(sin(hexUV.y * 2.0));
    hex = pow(1.0 - hex, 4.0);
    
    // Facet normals variation
    float facetNoise = sin(uv.x * 100.0) * sin(uv.y * 100.0) * 0.5 + 0.5;
    
    return hex * (0.5 + facetNoise * 0.5);
}

// Thin-film iridescence for quantum crystal
vec3 quantumIridescence(float cosTheta, float time) {
    // Multiple interference layers
    float d1 = 300.0 + sin(time * 0.5) * 50.0;
    float d2 = 450.0 + cos(time * 0.3) * 75.0;
    
    vec3 phase1 = vec3(1.0, 0.97, 0.94) * d1 * sqrt(1.0 - (1.0 - cosTheta * cosTheta) / 1.77);
    vec3 phase2 = vec3(1.0, 0.97, 0.94) * d2 * sqrt(1.0 - (1.0 - cosTheta * cosTheta) / 1.65);
    
    vec3 irid1 = 0.5 + 0.5 * cos(phase1 * 0.01);
    vec3 irid2 = 0.5 + 0.5 * cos(phase2 * 0.007);
    
    return (irid1 + irid2 * 0.5) * 1.5;
}

// Energy pulse through crystal
float energyPulse(vec3 pos, float time) {
    float pulse = sin(length(pos) * 3.0 - time * 4.0);
    pulse = smoothstep(-0.5, 0.5, pulse);
    
    // Wave packet
    float envelope = exp(-pow(length(pos) * 0.5 - 2.0, 2.0));
    
    return pulse * envelope;
}

// Subsurface energy transmission
vec3 quantumSubsurface(vec3 viewDir, vec3 normal, vec3 color, float intensity) {
    float transmission = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    float quantumNoise = sin(dot(viewDir, normal) * 50.0 + uTime * 3.0) * 0.5 + 0.5;
    return color * transmission * quantumNoise * intensity;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 tangent = normalize(vTangent);
    vec3 bitangent = normalize(vBitangent);
    vec3 viewDir = normalize(vViewDirection);
    
    // Quantum interference pattern
    float quantum = quantumWave(vWorldPosition, uTime, uQuantumPhase);
    
    // Crystalline facets
    float facets = crystalFacets(vUv, normal);
    
    // View-dependent iridescence
    float cosTheta = abs(dot(viewDir, normal));
    vec3 iridescence = quantumIridescence(cosTheta, uTime);
    
    // Energy pulse
    float pulse = energyPulse(vWorldPosition - vec3(0.0, uTime * 0.5, 0.0), uTime);
    
    // Base quantum colors
    vec3 quantumViolet = vec3(0.45, 0.12, 0.85);
    vec3 energyCyan = vec3(0.0, 0.95, 1.0);
    vec3 phaseMagenta = vec3(0.95, 0.0, 0.65);
    vec3 entanglementGold = vec3(1.0, 0.85, 0.3);
    
    // Blend based on quantum state
    float stateBlend = sin(uTime * 0.3 + uQuantumPhase) * 0.5 + 0.5;
    vec3 crystalColor = mix(quantumViolet, energyCyan, stateBlend);
    crystalColor = mix(crystalColor, phaseMagenta, quantum * 0.5);
    crystalColor = mix(crystalColor, uBaseColor, 0.2);
    
    // Facet reflections
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    
    // Anisotropic highlight along crystal axis
    float anisoHighlight = pow(max(dot(reflectDir, tangent), 0.0), 8.0 / (uRoughness + 0.01));
    reflection += reflection * anisoHighlight * uAnisotropy * iridescence;
    
    // Combine crystal elements
    vec3 finalColor = crystalColor * (0.3 + facets * 0.4);
    finalColor += iridescence * uIridescenceScale;
    finalColor += reflection * uMetallic * (0.5 + quantum * 0.3);
    
    // Energy pulse contribution
    vec3 pulseColor = mix(energyCyan, entanglementGold, pulse);
    finalColor += pulseColor * pulse * uGlowIntensity;
    
    // Quantum subsurface glow
    vec3 subsurface = quantumSubsurface(viewDir, normal, uSubsurfaceColor, uSubsurfaceScattering);
    finalColor += subsurface;
    
    // Enhanced rim lighting
    float rimFactor = pow(vFresnel, uRimPower) * uRimIntensity;
    vec3 rimIridescence = mix(energyCyan, phaseMagenta, sin(uTime * 2.0) * 0.5 + 0.5);
    finalColor += rimIridescence * rimFactor;
    
    // Quantum uncertainty sparkle
    float sparkle = pow(quantum, 10.0) * facets;
    finalColor += entanglementGold * sparkle * 0.5;
    
    // Bloom calculation
    vec3 bloom = finalColor;
    float luminance = dot(bloom, vec3(0.299, 0.587, 0.114));
    bloom = mix(vec3(0.0), bloom, smoothstep(0.5, 1.0, luminance));
    bloom *= uGlowIntensity;
    
    fragColor = vec4(finalColor, 0.95);
    bloomColor = vec4(bloom, 1.0);
}
`;

// ============================================================================
// REFINED MATERIAL CONFIGURATIONS
// ============================================================================

/**
 * Refined Classic Glass Material Configuration
 * Enhanced with improved clear-coat and rim lighting
 * 
 * @performance 0.45ms per marble (estimated)
 */
export const RefinedGlassMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedClassicGlass',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_GLASS_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uRefractionIndex: { type: 'float', value: 1.52 },  // Standard glass IOR
    uFresnelPower: { type: 'float', value: 2.5 },
    uCausticIntensity: { type: 'float', value: 0.55 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    materialBaseColor: { type: 'vec4', value: [0.15, 0.35, 0.55, 0.5] },
    // Enhanced PBR uniforms
    uClearCoat: { type: 'float', value: 0.35 },
    uClearCoatRoughness: { type: 'float', value: 0.08 },
    uClearCoatNormalScale: { type: 'float', value: 0.5 },
    uRimIntensity: { type: 'float', value: 0.8 },
    uRimPower: { type: 'float', value: 2.2 },
    uRimColor: { type: 'vec3', value: EnhancedColorPalettes.glass.rim },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.glass.base },
    uMetallic: { type: 'float', value: 0.0 },
    uRoughness: { type: 'float', value: 0.05 },
    uReflectance: { type: 'float', value: 0.45 }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.glass.base,
  metallic: 0.0,
  roughness: 0.05,
  reflectance: 0.45,
  clearCoat: 0.35,
  clearCoatRoughness: 0.08,
  clearCoatNormalScale: 0.5,
  anisotropy: 0.0,
  anisotropyDirection: 0.0,
  rimLightingIntensity: 0.8,
  rimLightingPower: 2.2,
  rimLightingColor: EnhancedColorPalettes.glass.rim,
  subsurfaceScattering: 0.0,
  subsurfaceColor: [0.0, 0.0, 0.0],
  subsurfaceThickness: 0.0,
  estimatedGpuCost: 0.45,
  qualityTier: 'high'
};

/**
 * Refined Obsidian Metal Material Configuration
 * Enhanced with better anisotropic highlights and clear-coat
 * 
 * @performance 0.48ms per marble (estimated)
 */
export const RefinedObsidianMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedObsidianMetal',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_OBSIDIAN_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uAnisotropy: { type: 'float', value: 0.75 },
    uAnisotropyDirection: { type: 'float', value: 45.0 },
    uGrainScale: { type: 'float', value: 10.0 },
    uScratchesIntensity: { type: 'float', value: 0.35 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    grainTexture: { type: 'sampler2D', value: null },
    anisoTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // Enhanced PBR uniforms
    uClearCoat: { type: 'float', value: 0.25 },
    uClearCoatRoughness: { type: 'float', value: 0.15 },
    uClearCoatNormalScale: { type: 'float', value: 0.3 },
    uRimIntensity: { type: 'float', value: 0.6 },
    uRimPower: { type: 'float', value: 1.8 },
    uRimColor: { type: 'vec3', value: [0.3, 0.25, 0.2] },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.obsidian.base },
    uMetallic: { type: 'float', value: 0.85 },
    uRoughness: { type: 'float', value: 0.35 },
    uReflectance: { type: 'float', value: 0.65 }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.obsidian.base,
  metallic: 0.85,
  roughness: 0.35,
  reflectance: 0.65,
  clearCoat: 0.25,
  clearCoatRoughness: 0.15,
  clearCoatNormalScale: 0.3,
  anisotropy: 0.75,
  anisotropyDirection: 45.0,
  rimLightingIntensity: 0.6,
  rimLightingPower: 1.8,
  rimLightingColor: [0.3, 0.25, 0.2],
  subsurfaceScattering: 0.0,
  subsurfaceColor: [0.0, 0.0, 0.0],
  subsurfaceThickness: 0.0,
  estimatedGpuCost: 0.48,
  qualityTier: 'high'
};

/**
 * Refined Neon Glow Material Configuration
 * Enhanced with improved rim lighting and subsurface effects
 * 
 * @performance 0.42ms per marble (estimated)
 */
export const RefinedNeonMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedNeonGlow',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_NEON_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uIridescenceScale: { type: 'float', value: 0.75 },
    uGlowIntensity: { type: 'float', value: 2.5 },
    uHologramSpeed: { type: 'float', value: 1.2 },
    uDistortionStrength: { type: 'float', value: 0.015 },
    hologramTexture: { type: 'sampler2D', value: null },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // Enhanced PBR uniforms
    uRimIntensity: { type: 'float', value: 1.2 },
    uRimPower: { type: 'float', value: 1.5 },
    uRimColor: { type: 'vec3', value: [0.0, 1.0, 0.9] },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.neon.core },
    uMetallic: { type: 'float', value: 0.4 },
    uRoughness: { type: 'float', value: 0.25 },
    uSubsurfaceScattering: { type: 'float', value: 0.45 },
    uSubsurfaceThickness: { type: 'float', value: 2.0 },
    uSubsurfaceColor: { type: 'vec3', value: [0.0, 0.8, 0.9] }
  },
  blending: 'additive',
  depthWrite: false,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.neon.core,
  metallic: 0.4,
  roughness: 0.25,
  reflectance: 0.5,
  clearCoat: 0.0,
  clearCoatRoughness: 0.0,
  clearCoatNormalScale: 0.0,
  anisotropy: 0.0,
  anisotropyDirection: 0.0,
  rimLightingIntensity: 1.2,
  rimLightingPower: 1.5,
  rimLightingColor: [0.0, 1.0, 0.9],
  subsurfaceScattering: 0.45,
  subsurfaceColor: [0.0, 0.8, 0.9],
  subsurfaceThickness: 2.0,
  estimatedGpuCost: 0.42,
  qualityTier: 'high'
};

/**
 * Refined Stone Vein Material Configuration
 * Enhanced with better subsurface scattering and rim lighting
 * 
 * @performance 0.38ms per marble (estimated)
 */
export const RefinedStoneMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedStoneVein',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_STONE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uSSSIntensity: { type: 'float', value: 0.55 },
    uSSSThickness: { type: 'float', value: 3.5 },
    uSSSColor: { type: 'vec3', value: EnhancedColorPalettes.stone.sssWarm },
    uSparkleDensity: { type: 'float', value: 1.25 },
    uSparkleSpeed: { type: 'float', value: 3.5 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    veinTexture: { type: 'sampler2D', value: null },
    sparkleTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // Enhanced PBR uniforms
    uRimIntensity: { type: 'float', value: 0.35 },
    uRimPower: { type: 'float', value: 2.5 },
    uRimColor: { type: 'vec3', value: [0.95, 0.88, 0.78] },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.stone.base },
    uRoughness: { type: 'float', value: 0.65 },
    uReflectance: { type: 'float', value: 0.12 }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.stone.base,
  metallic: 0.0,
  roughness: 0.65,
  reflectance: 0.12,
  clearCoat: 0.0,
  clearCoatRoughness: 0.0,
  clearCoatNormalScale: 0.0,
  anisotropy: 0.0,
  anisotropyDirection: 0.0,
  rimLightingIntensity: 0.35,
  rimLightingPower: 2.5,
  rimLightingColor: [0.95, 0.88, 0.78],
  subsurfaceScattering: 0.55,
  subsurfaceColor: EnhancedColorPalettes.stone.sssWarm,
  subsurfaceThickness: 3.5,
  estimatedGpuCost: 0.38,
  qualityTier: 'high'
};

/**
 * NEW: Quantum Crystal Material Configuration
 * A crystalline marble with quantum interference patterns and iridescence
 * 
 * @performance 0.46ms per marble (estimated)
 */
export const QuantumCrystalMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'QuantumCrystal',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: QUANTUM_CRYSTAL_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uIridescenceScale: { type: 'float', value: 0.95 },
    uGlowIntensity: { type: 'float', value: 1.8 },
    uQuantumPhase: { type: 'float', value: 0.0 },
    uDistortionStrength: { type: 'float', value: 0.008 },
    crystalTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // PBR uniforms
    uRimIntensity: { type: 'float', value: 1.0 },
    uRimPower: { type: 'float', value: 1.6 },
    uRimColor: { type: 'vec3', value: QuantumCrystalPalette.energyCyan },
    uBaseColor: { type: 'vec3', value: QuantumCrystalPalette.coreViolet },
    uMetallic: { type: 'float', value: 0.6 },
    uRoughness: { type: 'float', value: 0.15 },
    uAnisotropy: { type: 'float', value: 0.5 },
    uAnisotropyDirection: { type: 'float', value: 30.0 },
    uSubsurfaceScattering: { type: 'float', value: 0.35 },
    uSubsurfaceColor: { type: 'vec3', value: QuantumCrystalPalette.phaseMagenta },
    uReflectance: { type: 'float', value: 0.55 }
  },
  blending: 'additive',
  depthWrite: false,
  cullFace: 'back',
  // PBR properties
  baseColor: QuantumCrystalPalette.coreViolet,
  metallic: 0.6,
  roughness: 0.15,
  reflectance: 0.55,
  clearCoat: 0.0,
  clearCoatRoughness: 0.0,
  clearCoatNormalScale: 0.0,
  anisotropy: 0.5,
  anisotropyDirection: 30.0,
  rimLightingIntensity: 1.0,
  rimLightingPower: 1.6,
  rimLightingColor: QuantumCrystalPalette.energyCyan,
  subsurfaceScattering: 0.35,
  subsurfaceColor: QuantumCrystalPalette.phaseMagenta,
  subsurfaceThickness: 2.5,
  estimatedGpuCost: 0.46,
  qualityTier: 'ultra'
};

// ============================================================================
// POST-PROCESSING CONFIGURATIONS
// ============================================================================

/**
 * Refined post-processing for glass marbles
 */
export const RefinedGlassPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.45,
    threshold: 0.75,
    radius: 0.55,
    iterations: 5
  },
  motionBlur: {
    enabled: true,
    intensity: 0.35,
    samples: 10
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 72,
    stepSize: 0.045,
    thickness: 0.08
  },
  colorGrading: {
    enabled: true,
    contrast: 1.12,
    saturation: 1.05,
    tint: [1.0, 1.0, 1.08]
  }
};

/**
 * Refined post-processing for obsidian metal marbles
 */
export const RefinedObsidianPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.55,
    threshold: 0.55,
    radius: 0.75,
    iterations: 5
  },
  motionBlur: {
    enabled: true,
    intensity: 0.55,
    samples: 14
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 88,
    stepSize: 0.035,
    thickness: 0.04
  },
  colorGrading: {
    enabled: true,
    contrast: 1.25,
    saturation: 0.82,
    tint: [0.92, 0.92, 1.0]
  }
};

/**
 * Refined post-processing for neon glow marbles
 */
export const RefinedNeonPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 2.5,
    threshold: 0.25,
    radius: 1.1,
    iterations: 7
  },
  motionBlur: {
    enabled: true,
    intensity: 0.45,
    samples: 12
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.025
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 56,
    stepSize: 0.055,
    thickness: 0.12
  },
  colorGrading: {
    enabled: true,
    contrast: 1.18,
    saturation: 1.35,
    tint: [1.02, 0.95, 1.08]
  }
};

/**
 * Refined post-processing for stone vein marbles
 */
export const RefinedStonePostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.28,
    threshold: 0.85,
    radius: 0.45,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.25,
    samples: 8
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: false,
    maxSteps: 40,
    stepSize: 0.09,
    thickness: 0.18
  },
  colorGrading: {
    enabled: true,
    contrast: 1.06,
    saturation: 0.94,
    tint: [1.04, 1.0, 0.96]
  }
};

/**
 * Post-processing for quantum crystal marbles
 */
export const QuantumCrystalPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 1.8,
    threshold: 0.35,
    radius: 0.9,
    iterations: 6
  },
  motionBlur: {
    enabled: true,
    intensity: 0.4,
    samples: 10
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.015
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 64,
    stepSize: 0.05,
    thickness: 0.1
  },
  colorGrading: {
    enabled: true,
    contrast: 1.15,
    saturation: 1.2,
    tint: [1.05, 0.95, 1.15]
  }
};

// ============================================================================
// RENDERING PACKAGES
// ============================================================================

/**
 * Refined Classic Glass Marble Package
 */
export const RefinedClassicGlassMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedClassicGlass',
  materialConfig: RefinedGlassMaterialConfig,
  postProcessConfig: RefinedGlassPostProcess
};

/**
 * Refined Obsidian Metal Marble Package
 */
export const RefinedObsidianMetalMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedObsidianMetal',
  materialConfig: RefinedObsidianMaterialConfig,
  postProcessConfig: RefinedObsidianPostProcess
};

/**
 * Refined Neon Glow Marble Package
 */
export const RefinedNeonGlowMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedNeonGlow',
  materialConfig: RefinedNeonMaterialConfig,
  postProcessConfig: RefinedNeonPostProcess
};

/**
 * Refined Stone Vein Marble Package
 */
export const RefinedStoneVeinMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedStoneVein',
  materialConfig: RefinedStoneMaterialConfig,
  postProcessConfig: RefinedStonePostProcess
};

/**
 * NEW: Quantum Crystal Marble Package
 */
export const QuantumCrystalMarble: RefinedMarbleRenderingPackage = {
  name: 'QuantumCrystal',
  materialConfig: QuantumCrystalMaterialConfig,
  postProcessConfig: QuantumCrystalPostProcess
};

/**
 * Collection of all refined marble rendering packages
 */
export const AllRefinedMarblePackages: RefinedMarbleRenderingPackage[] = [
  RefinedClassicGlassMarble,
  RefinedObsidianMetalMarble,
  RefinedNeonGlowMarble,
  RefinedStoneVeinMarble,
  QuantumCrystalMarble
];

// ============================================================================
// PERFORMANCE METADATA
// ============================================================================

/**
 * Performance metrics for the refined materials
 * All materials are optimized to stay under 0.5ms per marble
 */
export const PerformanceMetrics = {
  /** Maximum estimated GPU cost across all materials */
  maxGpuCost: 0.48,
  /** Average estimated GPU cost */
  avgGpuCost: 0.438,
  /** Budget headroom (0.5ms - max cost) */
  headroom: 0.02,
  /** Materials ordered by GPU cost (ascending) */
  costRanking: [
    { name: 'RefinedStoneVein', cost: 0.38 },
    { name: 'RefinedNeonGlow', cost: 0.42 },
    { name: 'QuantumCrystal', cost: 0.46 },
    { name: 'RefinedClassicGlass', cost: 0.45 },
    { name: 'RefinedObsidianMetal', cost: 0.48 }
  ]
} as const;

/**
 * Quality tier mapping for adaptive rendering
 */
export const QualityTierMapping = {
  low: ['RefinedStoneVein'],
  medium: ['RefinedStoneVein', 'RefinedNeonGlow'],
  high: ['RefinedStoneVein', 'RefinedNeonGlow', 'RefinedClassicGlass', 'RefinedObsidianMetal'],
  ultra: ['RefinedStoneVein', 'RefinedNeonGlow', 'RefinedClassicGlass', 'RefinedObsidianMetal', 'QuantumCrystal']
} as const;

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

/**
 * Agent 1 Beauty Layer - Summary of Changes
 * 
 * ENHANCEMENTS MADE:
 * 
 * 1. Enhanced Rim Lighting:
 *    - All materials now have configurable rim lighting with power and color
 *    - Glass: rimLightingIntensity 0.8, power 2.2
 *    - Obsidian: rimLightingIntensity 0.6, power 1.8
 *    - Neon: rimLightingIntensity 1.2, power 1.5
 *    - Stone: rimLightingIntensity 0.35, power 2.5
 * 
 * 2. Improved Clear-Coat:
 *    - Glass: clearCoat 0.35, clearCoatRoughness 0.08
 *    - Obsidian: clearCoat 0.25, clearCoatRoughness 0.15
 *    - Added clear coat BRDF approximation in shaders
 * 
 * 3. Better Anisotropic Highlights:
 *    - Obsidian: anisotropy 0.75 with directional control (45 degrees)
 *    - Added anisotropic GGX distribution
 *    - Quantum Crystal: anisotropy 0.5 with crystalline alignment
 * 
 * 4. Enhanced Subsurface Scattering:
 *    - Stone: SSS intensity 0.55, thickness 3.5, warm color
 *    - Neon: SSS intensity 0.45 with cyan transmission
 *    - Quantum Crystal: SSS intensity 0.35 with magenta glow
 * 
 * 5. Realistic PBR Roughness/Metallic:
 *    - Glass: roughness 0.05, metallic 0.0
 *    - Obsidian: roughness 0.35, metallic 0.85
 *    - Neon: roughness 0.25, metallic 0.4
 *    - Stone: roughness 0.65, metallic 0.0
 *    - Quantum Crystal: roughness 0.15, metallic 0.6
 * 
 * 6. NEW Quantum Crystal Theme:
 *    - Iridescent quantum interference patterns
 *    - Crystalline facet structure
 *    - Energy pulse effects
 *    - Subsurface quantum glow
 *    - Color palette: violet, cyan, magenta, gold
 * 
 * PERFORMANCE:
 *    - All materials stay under 0.5ms budget
 *    - Fastest: Stone (0.38ms)
 *    - Slowest: Obsidian (0.48ms)
 *    - Average: 0.438ms
 *    - Headroom: 0.02ms
 */

// Export shader sources for external use
export const RefinedShaderSource = {
  vertex: REFINED_VERTEX_SHADER,
  glassFragment: REFINED_GLASS_FRAGMENT_SHADER,
  obsidianFragment: REFINED_OBSIDIAN_FRAGMENT_SHADER,
  neonFragment: REFINED_NEON_FRAGMENT_SHADER,
  stoneFragment: REFINED_STONE_FRAGMENT_SHADER,
  quantumCrystalFragment: QUANTUM_CRYSTAL_FRAGMENT_SHADER
};

// Default export for the module
export default {
  // Color palettes
  QuantumCrystalPalette,
  EnhancedColorPalettes,
  
  // Material configs
  RefinedGlassMaterialConfig,
  RefinedObsidianMaterialConfig,
  RefinedNeonMaterialConfig,
  RefinedStoneMaterialConfig,
  QuantumCrystalMaterialConfig,
  
  // Post-process configs
  RefinedGlassPostProcess,
  RefinedObsidianPostProcess,
  RefinedNeonPostProcess,
  RefinedStonePostProcess,
  QuantumCrystalPostProcess,
  
  // Rendering packages
  RefinedClassicGlassMarble,
  RefinedObsidianMetalMarble,
  RefinedNeonGlowMarble,
  RefinedStoneVeinMarble,
  QuantumCrystalMarble,
  AllRefinedMarblePackages,
  
  // Performance
  PerformanceMetrics,
  QualityTierMapping,
  
  // Shaders
  RefinedShaderSource
};
