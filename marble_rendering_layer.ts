/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Agent 3: Custom Filament shaders and effects
 * 
 * Requires: Filament.js (Google's physically based rendering engine)
 */

// ============================================================================
// FILAMENT MATERIAL DEFINITIONS
// ============================================================================

/**
 * Custom Fragment Shader: Classic Glass Marble
 * Features: Refraction, internal reflections, caustics simulation
 */
const CLASSIC_GLASS_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D noiseTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uRefractionIndex;
uniform float uFresnelPower;
uniform float uCausticIntensity;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;

// Schlick's Fresnel approximation
float fresnel(vec3 viewDir, vec3 normal, float power) {
    return pow(1.0 - abs(dot(viewDir, normal)), power);
}

// Caustic pattern simulation
float causticPattern(vec3 pos, float time) {
    float caustic = 0.0;
    vec3 p = pos * 2.0;
    
    // Layered noise for caustic effect
    caustic += sin(p.x * 3.0 + time) * cos(p.y * 3.0 + time * 0.7);
    caustic += sin(p.y * 5.0 - time * 0.5) * cos(p.z * 5.0 + time * 0.3) * 0.5;
    caustic += sin(p.z * 7.0 + time * 0.8) * cos(p.x * 7.0 - time * 0.4) * 0.25;
    
    return caustic * 0.5 + 0.5;
}

// Refraction calculation
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

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Fresnel effect for glass edge highlighting
    float fresnelFactor = fresnel(viewDir, normal, uFresnelPower);
    
    // Refraction direction
    vec3 refractDir = refractRay(-viewDir, normal, uRefractionIndex);
    
    // Sample environment map for reflection
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflectionColor = texture(envMap, reflectDir).rgb;
    vec3 refractionColor = texture(envMap, refractDir).rgb;
    
    // Internal caustic patterns
    vec3 internalPos = vWorldPosition * 0.5 + vec3(0.0, uTime * 0.1, 0.0);
    float caustic = causticPattern(internalPos, uTime);
    caustic = pow(caustic, 3.0) * uCausticIntensity;
    
    // Chromatic dispersion (fake with RGB offsets)
    vec3 dispersion = vec3(
        texture(envMap, refractDir * 0.98).r,
        texture(envMap, refractDir).g,
        texture(envMap, refractDir * 1.02).b
    );
    
    // Combine reflection and refraction
    vec3 glassColor = mix(refractionColor, reflectionColor, fresnelFactor);
    glassColor = mix(glassColor, dispersion, 0.15);
    
    // Add caustic highlights
    vec3 causticColor = vec3(1.0, 0.95, 0.8) * caustic;
    glassColor += causticColor * (1.0 - fresnelFactor);
    
    // Inner swirl from base texture
    vec4 baseColor = materialBaseColor;
    glassColor = mix(glassColor, baseColor.rgb * 1.5, baseColor.a * 0.3);
    
    // Attenuation through glass
    float thickness = 1.0 - abs(dot(viewDir, normal));
    glassColor *= exp(-thickness * 0.3);
    
    fragColor = vec4(glassColor, 0.85 + fresnelFactor * 0.15);
}
`;

/**
 * Custom Fragment Shader: Obsidian Metal Marble
 * Features: Anisotropic reflections, procedural metal grain
 */
const OBSIDIAN_METAL_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D grainTexture;
uniform sampler2D anisoTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uAnisotropy;
uniform float uGrainScale;
uniform float uScratchesIntensity;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;

// Anisotropic Ward BRDF approximation
float wardAnisotropic(vec3 L, vec3 V, vec3 N, vec3 T, vec3 B, 
                      float ax, float ay) {
    vec3 H = normalize(L + V);
    float TH = dot(T, H);
    float BH = dot(B, H);
    float NH = max(dot(N, H), 0.0);
    float NV = max(dot(N, V), 0.0);
    float NL = max(dot(N, L), 0.0);
    
    if (NH <= 0.0 || NL <= 0.0 || NV <= 0.0) return 0.0;
    
    float beta = -2.0 * (TH * TH / (ax * ax) + BH * BH / (ay * ay));
    beta /= (1.0 + NH);
    
    return exp(beta) / (4.0 * 3.14159 * ax * ay * sqrt(NL * NV));
}

// Procedural metal grain
float metalGrain(vec2 uv, float scale) {
    vec2 uvScaled = uv * scale;
    
    // Base grain pattern
    float grain = sin(uvScaled.x * 50.0) * sin(uvScaled.y * 50.0);
    grain += sin(uvScaled.x * 120.0 + uvScaled.y * 80.0) * 0.5;
    grain += sin(uvScaled.x * 200.0 - uvScaled.y * 150.0) * 0.25;
    
    return grain / 1.75 * 0.5 + 0.5;
}

// Micro-scratches from volcanic formation
float volcanicScratches(vec3 pos, vec2 uv) {
    float scratches = 0.0;
    
    // Random scratch directions based on position
    float angle1 = sin(pos.x * 3.7) * 3.14159;
    float angle2 = cos(pos.z * 4.2) * 3.14159;
    
    vec2 dir1 = vec2(cos(angle1), sin(angle1));
    vec2 dir2 = vec2(cos(angle2), sin(angle2));
    
    float line1 = abs(dot(uv - 0.5, dir1)) * 20.0;
    float line2 = abs(dot(uv - 0.5, dir2)) * 15.0;
    
    scratches += exp(-line1 * line1) * 0.5;
    scratches += exp(-line2 * line2) * 0.3;
    
    return scratches * uScratchesIntensity;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 tangent = normalize(vTangent);
    vec3 bitangent = normalize(vBitangent);
    vec3 viewDir = normalize(vViewDirection);
    
    // Sample grain texture
    float grain = metalGrain(vUv, uGrainScale);
    vec3 grainNormal = vec3(
        (grain - 0.5) * 0.1,
        (grain - 0.5) * 0.1,
        1.0
    );
    grainNormal = normalize(
        grainNormal.x * tangent + 
        grainNormal.y * bitangent + 
        grainNormal.z * normal
    );
    
    // Anisotropic roughness (elongated highlights)
    float ax = 0.1 + grain * 0.1;  // Roughness along tangent
    float ay = 0.3 + grain * 0.2;  // Roughness along bitangent
    
    // Simulate multiple light sources for anisotropic effect
    vec3 lightDir1 = normalize(vec3(1.0, 1.0, 1.0));
    vec3 lightDir2 = normalize(vec3(-0.5, 0.8, -0.3));
    
    float aniso1 = wardAnisotropic(lightDir1, viewDir, grainNormal, tangent, bitangent, ax, ay);
    float aniso2 = wardAnisotropic(lightDir2, viewDir, grainNormal, tangent, bitangent, ax, ay);
    
    // Environment reflection with anisotropic blur
    vec3 reflectDir = reflect(-viewDir, grainNormal);
    vec3 baseReflect = texture(envMap, reflectDir).rgb;
    
    // Add anisotropic streaks to reflection
    float streak = pow(max(dot(reflectDir, tangent), 0.0), 8.0 / ax);
    vec3 anisoReflect = baseReflect * (1.0 + streak * uAnisotropy);
    
    // Scratches
    float scratches = volcanicScratches(vWorldPosition, vUv);
    
    // Combine materials
    vec3 obsidianColor = vec3(0.02, 0.02, 0.03);  // Near-black base
    vec3 metalColor = vec3(0.15, 0.15, 0.18);      // Dark metallic
    
    vec3 finalColor = mix(obsidianColor, metalColor, grain);
    finalColor += anisoReflect * (0.5 + grain * 0.3);
    finalColor += (aniso1 + aniso2) * 0.5 * vec3(0.9, 0.92, 1.0);
    
    // Scratches catch light
    finalColor += scratches * anisoReflect;
    
    // Edge darkening (obsidian characteristic)
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    finalColor *= (0.3 + 0.7 * fresnel);
    
    // Subtle heat shimmer at edges (volcanic origin)
    float heat = sin(vWorldPosition.y * 10.0 + uTime * 2.0) * 0.5 + 0.5;
    heat *= pow(fresnel, 4.0) * 0.1;
    finalColor += vec3(heat * 0.5, heat * 0.2, 0.0);
    
    fragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Custom Fragment Shader: Neon Glow Marble
 * Features: Iridescence, holographic shimmer, bloom contribution
 */
const NEON_GLOW_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D hologramTexture;
uniform sampler2D noiseTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uIridescenceScale;
uniform float uGlowIntensity;
uniform float uHologramSpeed;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vDepth;

out vec4 fragColor;
out vec4 bloomColor;  // For separate bloom pass

// Thin-film interference for iridescence
vec3 thinFilmIridescence(float cosTheta, float d, float nFilm) {
    // Phase shift
    float delta = 2.0 * 3.14159 * nFilm * d * sqrt(1.0 - (1.0 - cosTheta * cosTheta) / (nFilm * nFilm));
    
    // Constructive/destructive interference for RGB
    vec3 phase = vec3(delta, delta * 0.97, delta * 0.94);
    vec3 intensity = 0.5 + 0.5 * cos(phase);
    
    // Convert to color
    vec3 irid;
    irid.r = intensity.r;
    irid.g = intensity.g;
    irid.b = intensity.b;
    
    return irid;
}

// Holographic pattern
vec3 holographicPattern(vec2 uv, float time) {
    vec3 color = vec3(0.0);
    
    // Scanlines
    float scanline = sin(uv.y * 200.0 + time * 10.0) * 0.5 + 0.5;
    scanline = pow(scanline, 20.0) * 0.3;
    
    // Rainbow diffraction
    float diffraction = sin(uv.x * 100.0 + time) * sin(uv.y * 80.0 - time * 0.5);
    vec3 rainbow = vec3(
        sin(diffraction * 3.14159),
        sin(diffraction * 3.14159 + 2.094),
        sin(diffraction * 3.14159 + 4.189)
    ) * 0.5 + 0.5;
    
    // Hexagonal grid (holographic security pattern)
    vec2 hexUV = uv * 30.0;
    float hex = abs(sin(hexUV.x * 1.732 + hexUV.y) * 
                    sin(hexUV.x * 1.732 - hexUV.y) * 
                    sin(hexUV.y * 2.0));
    hex = pow(1.0 - hex, 10.0);
    
    color = rainbow * hex * 0.5 + scanline;
    
    return color;
}

// Glitch effect
vec2 glitchOffset(vec2 uv, float time) {
    float glitch = sin(time * 20.0) * sin(time * 45.0);
    glitch = step(0.97, glitch);
    
    float offset = sin(time * 100.0) * 0.02 * glitch;
    return vec2(offset, 0.0);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // View-dependent iridescence
    float cosTheta = abs(dot(viewDir, normal));
    float filmThickness = 400.0 + sin(vUv.x * 10.0 + vUv.y * 8.0 + uTime) * 100.0;
    vec3 iridescence = thinFilmIridescence(cosTheta, filmThickness, 1.33);
    
    // Base holographic pattern
    vec2 glitchUV = vUv + glitchOffset(vUv, uTime);
    vec3 hologram = holographicPattern(glitchUV, uTime * uHologramSpeed);
    
    // Energy core glow (center of marble)
    float distFromCenter = length(vUv - 0.5);
    float coreGlow = exp(-distFromCenter * 4.0) * uGlowIntensity;
    
    // Pulse effect
    float pulse = sin(uTime * 3.0) * 0.3 + 0.7;
    coreGlow *= pulse;
    
    // Circuit patterns on surface
    float circuit = 0.0;
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float radius = distFromCenter * 20.0;
    circuit += sin(angle * 8.0 + radius * 2.0 + uTime) * 0.5 + 0.5;
    circuit *= exp(-abs(radius - 5.0) * 0.5);
    circuit *= exp(-abs(radius - 8.0) * 0.3);
    
    // Neon colors
    vec3 neonCyan = vec3(0.0, 1.0, 1.0);
    vec3 neonPink = vec3(1.0, 0.0, 0.5);
    vec3 neonPurple = vec3(0.5, 0.0, 1.0);
    
    vec3 baseColor = mix(neonCyan, neonPink, sin(uTime) * 0.5 + 0.5);
    baseColor = mix(baseColor, neonPurple, iridescence.b);
    
    // Combine effects
    vec3 finalColor = baseColor * (0.3 + hologram * 0.7);
    finalColor += iridescence * uIridescenceScale;
    finalColor += baseColor * coreGlow;
    finalColor += neonCyan * circuit * 0.5;
    
    // Fresnel rim lighting
    float fresnel = pow(1.0 - cosTheta, 3.0);
    finalColor += baseColor * fresnel * 2.0;
    
    // Reflection with color shift
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    finalColor += reflection * iridescence * 0.3;
    
    // Calculate bloom contribution
    vec3 bloom = finalColor;
    // Threshold for bloom (only bright areas)
    float luminance = dot(bloom, vec3(0.299, 0.587, 0.114));
    bloom = mix(vec3(0.0), bloom, smoothstep(0.5, 1.0, luminance));
    bloom *= uGlowIntensity;
    
    fragColor = vec4(finalColor, 0.95);
    bloomColor = vec4(bloom, 1.0);
}
`;

/**
 * Custom Fragment Shader: Stone Vein Marble
 * Features: Subsurface scattering, mineral sparkle
 */
const STONE_VEIN_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D veinTexture;
uniform sampler2D sparkleTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uSSSIntensity;
uniform float uSparkleDensity;
uniform float uSparkleSpeed;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;

// Subsurface scattering approximation
float subsurfaceScattering(vec3 viewDir, vec3 normal, vec3 lightDir, float thickness) {
    // Wrap lighting for subsurface
    float wrap = 0.5;
    float dotNL = max(dot(normal, lightDir), 0.0);
    float scattering = max(dotNL + wrap, 0.0) / ((1.0 + wrap) * (1.0 + wrap));
    
    // View-dependent translucency
    vec3 backDir = -lightDir;
    float viewScatter = max(dot(viewDir, backDir), 0.0);
    
    return scattering * viewScatter * thickness;
}

// Mineral sparkle based on microfacets
float mineralSparkle(vec3 pos, vec3 normal, vec3 viewDir, vec2 uv) {
    float sparkle = 0.0;
    
    // Multiple sparkle sources at different scales
    vec3 sparklePos = pos * 50.0;
    
    // Random sparkle positions
    float s1 = sin(sparklePos.x * 12.9898 + sparklePos.y * 78.233) * 43758.5453;
    float s2 = sin(sparklePos.y * 43.1234 + sparklePos.z * 23.456) * 23421.6789;
    float s3 = sin(sparklePos.z * 19.8765 + sparklePos.x * 54.321) * 12345.6789;
    
    s1 = fract(s1);
    s2 = fract(s2);
    s3 = fract(s3);
    
    // View-dependent intensity (sparkle when looking at glancing angles)
    float viewFactor = 1.0 - abs(dot(viewDir, normal));
    viewFactor = pow(viewFactor, 4.0);
    
    // Temporal sparkle (twinkling)
    float twinkle1 = sin(uTime * uSparkleSpeed + s1 * 100.0) * 0.5 + 0.5;
    float twinkle2 = sin(uTime * uSparkleSpeed * 0.7 + s2 * 100.0) * 0.5 + 0.5;
    float twinkle3 = sin(uTime * uSparkleSpeed * 1.3 + s3 * 100.0) * 0.5 + 0.5;
    
    // Combine sparkles
    sparkle += step(0.97, s1) * twinkle1 * viewFactor;
    sparkle += step(0.98, s2) * twinkle2 * viewFactor * 0.7;
    sparkle += step(0.99, s3) * twinkle3 * viewFactor * 0.5;
    
    return sparkle * uSparkleDensity;
}

// Vein pattern with depth
float veinPattern(vec2 uv, float time) {
    float pattern = 0.0;
    
    // Main veins
    vec2 p = uv * 3.0;
    float vein1 = sin(p.x * 2.0 + sin(p.y * 3.0 + time * 0.1)) * 0.5 + 0.5;
    vein1 = smoothstep(0.6, 0.65, vein1);
    
    // Secondary veins
    float vein2 = sin(p.y * 4.0 + sin(p.x * 2.0 - time * 0.05)) * 0.5 + 0.5;
    vein2 = smoothstep(0.7, 0.75, vein2) * 0.5;
    
    // Fine cracks
    float cracks = sin(p.x * 20.0) * sin(p.y * 20.0) * 0.5 + 0.5;
    cracks = pow(cracks, 10.0) * 0.2;
    
    pattern = vein1 + vein2 + cracks;
    
    return pattern;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Sample vein texture
    vec4 veinTex = texture(veinTexture, vUv);
    
    // Stone colors
    vec3 baseStone = vec3(0.85, 0.82, 0.78);  // Warm white marble
    vec3 veinColor = vec3(0.3, 0.25, 0.35);    // Purple-gray veins
    
    // Procedural veins
    float veins = veinPattern(vUv, uTime * 0.1);
    
    // Blend stone with veins
    vec3 stoneColor = mix(baseStone, veinColor, veins * veinTex.r);
    
    // Subsurface scattering through thinner vein areas
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float thickness = 1.0 - veins * 0.7;  // Thinner at veins
    float sss = subsurfaceScattering(viewDir, normal, lightDir, thickness);
    
    // Warm subsurface color
    vec3 sssColor = vec3(1.0, 0.85, 0.7) * sss * uSSSIntensity;
    stoneColor += sssColor;
    
    // Mineral sparkles
    float sparkle = mineralSparkle(vWorldPosition, normal, viewDir, vUv);
    vec3 sparkleColor = vec3(1.0, 0.95, 0.8) * sparkle;
    stoneColor += sparkleColor;
    
    // Surface roughness variation
    float roughness = mix(0.4, 0.8, veins);
    
    // Diffuse lighting
    float diff = max(dot(normal, lightDir), 0.0);
    stoneColor *= (0.3 + 0.7 * diff);
    
    // Soft specular
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0 / roughness);
    stoneColor += vec3(1.0) * spec * (1.0 - veins * 0.5);
    
    // Ambient occlusion in vein crevices
    float ao = 1.0 - veins * 0.3;
    stoneColor *= ao;
    
    // Environment reflection (subtle)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    stoneColor += reflection * 0.05 * (1.0 - roughness);
    
    fragColor = vec4(stoneColor, 1.0);
}
`;

/**
 * Vertex Shader (shared across all marbles)
 */
const MARBLE_VERTEX_SHADER = `
#include "common_types.glsl"

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform float uTime;
uniform float uDistortionStrength;

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

void main() {
    vec3 pos = position;
    
    // Optional: subtle vertex distortion for energy effects
    // Only used by neon marble, others set uDistortionStrength to 0
    float distortion = sin(pos.x * 10.0 + uTime * 2.0) * 
                       cos(pos.y * 10.0 + uTime * 1.5) * 
                       uDistortionStrength;
    pos += normal * distortion;
    
    // Transform to world space
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view direction
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewDirection = -viewPosition.xyz;
    vDepth = -viewPosition.z;
    
    // Transform normal, tangent, bitangent to world space
    vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = normalize((normalMatrix * vec4(tangent, 0.0)).xyz);
    vBitangent = cross(vNormal, vTangent);
    
    vUv = uv;
    
    gl_Position = projectionMatrix * viewPosition;
}
`;

// ============================================================================
// MATERIAL CONFIGURATION
// ============================================================================

export interface MarbleMaterialConfig {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { type: string; value: any }>;
  blending: 'opaque' | 'transparent' | 'additive';
  depthWrite: boolean;
  cullFace: 'front' | 'back' | 'none';
}

export const GlassMaterialConfig: MarbleMaterialConfig = {
  name: 'ClassicGlass',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: CLASSIC_GLASS_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uRefractionIndex: { type: 'float', value: 1.52 },  // Glass IOR
    uFresnelPower: { type: 'float', value: 2.0 },
    uCausticIntensity: { type: 'float', value: 0.4 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    materialBaseColor: { type: 'vec4', value: [0.2, 0.4, 0.6, 0.5] }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back'
};

export const ObsidianMaterialConfig: MarbleMaterialConfig = {
  name: 'ObsidianMetal',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: OBSIDIAN_METAL_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uAnisotropy: { type: 'float', value: 1.5 },
    uGrainScale: { type: 'float', value: 8.0 },
    uScratchesIntensity: { type: 'float', value: 0.3 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    grainTexture: { type: 'sampler2D', value: null },
    anisoTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back'
};

export const NeonMaterialConfig: MarbleMaterialConfig = {
  name: 'NeonGlow',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: NEON_GLOW_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uIridescenceScale: { type: 'float', value: 0.6 },
    uGlowIntensity: { type: 'float', value: 2.0 },
    uHologramSpeed: { type: 'float', value: 1.0 },
    uDistortionStrength: { type: 'float', value: 0.01 },
    hologramTexture: { type: 'sampler2D', value: null },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'additive',
  depthWrite: false,
  cullFace: 'back'
};

export const StoneMaterialConfig: MarbleMaterialConfig = {
  name: 'StoneVein',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: STONE_VEIN_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uSSSIntensity: { type: 'float', value: 0.3 },
    uSparkleDensity: { type: 'float', value: 1.0 },
    uSparkleSpeed: { type: 'float', value: 3.0 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    veinTexture: { type: 'sampler2D', value: null },
    sparkleTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back'
};

// ============================================================================
// PARTICLE EFFECT SYSTEMS
// ============================================================================

export interface ParticleEffect {
  name: string;
  maxParticles: number;
  emissionRate: number;
  lifetime: { min: number; max: number };
  size: { start: number; end: number };
  color: { start: [number, number, number, number]; end: [number, number, number, number] };
  velocity: { type: 'radial' | 'directional' | 'burst'; speed: number; spread: number };
  acceleration: [number, number, number];
  texture: string;
  blending: 'additive' | 'normal';
  trigger: 'speed' | 'impact' | 'boost' | 'continuous';
  triggerThreshold?: number;
}

export const SpeedSparkleEffect: ParticleEffect = {
  name: 'SpeedSparkles',
  maxParticles: 100,
  emissionRate: 0,  // Emission controlled by speed
  lifetime: { min: 0.3, max: 0.8 },
  size: { start: 0.05, end: 0.0 },
  color: {
    start: [1.0, 1.0, 0.8, 0.8],
    end: [1.0, 0.6, 0.2, 0.0]
  },
  velocity: { type: 'directional', speed: 2.0, spread: 0.5 },
  acceleration: [0, -2.0, 0],  // Gravity
  texture: 'particle_sparkle.png',
  blending: 'additive',
  trigger: 'speed',
  triggerThreshold: 5.0  // Trigger when speed > 5 units/sec
};

export const ImpactBurstEffect: ParticleEffect = {
  name: 'ImpactBurst',
  maxParticles: 50,
  emissionRate: 0,  // One-shot on impact
  lifetime: { min: 0.2, max: 0.6 },
  size: { start: 0.1, end: 0.0 },
  color: {
    start: [1.0, 0.9, 0.7, 1.0],
    end: [0.8, 0.3, 0.1, 0.0]
  },
  velocity: { type: 'burst', speed: 8.0, spread: 1.0 },
  acceleration: [0, -5.0, 0],
  texture: 'particle_burst.png',
  blending: 'additive',
  trigger: 'impact',
  triggerThreshold: 3.0  // Impact force threshold
};

export const BoostFlameEffect: ParticleEffect = {
  name: 'BoostFlame',
  maxParticles: 200,
  emissionRate: 60,
  lifetime: { min: 0.1, max: 0.4 },
  size: { start: 0.15, end: 0.05 },
  color: {
    start: [0.2, 0.6, 1.0, 0.9],
    end: [0.0, 0.2, 0.8, 0.0]
  },
  velocity: { type: 'directional', speed: -10.0, spread: 0.3 },
  acceleration: [0, 0, 0],
  texture: 'particle_flame.png',
  blending: 'additive',
  trigger: 'boost'
};

export const NeonTrailEffect: ParticleEffect = {
  name: 'NeonTrail',
  maxParticles: 150,
  emissionRate: 30,
  lifetime: { min: 0.5, max: 1.0 },
  size: { start: 0.08, end: 0.0 },
  color: {
    start: [0.0, 1.0, 1.0, 0.7],
    end: [0.5, 0.0, 1.0, 0.0]
  },
  velocity: { type: 'directional', speed: 0.5, spread: 0.1 },
  acceleration: [0, 0, 0],
  texture: 'particle_trail.png',
  blending: 'additive',
  trigger: 'continuous'
};

// ============================================================================
// POST-PROCESSING CONFIGURATION
// ============================================================================

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

export const GlassPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.3,
    threshold: 0.8,
    radius: 0.5,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.3,
    samples: 8
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 64,
    stepSize: 0.05,
    thickness: 0.1
  },
  colorGrading: {
    enabled: true,
    contrast: 1.1,
    saturation: 1.0,
    tint: [1.0, 1.0, 1.05]  // Slight blue tint
  }
};

export const ObsidianPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.4,
    threshold: 0.6,
    radius: 0.7,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.5,
    samples: 12
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 80,
    stepSize: 0.04,
    thickness: 0.05
  },
  colorGrading: {
    enabled: true,
    contrast: 1.2,
    saturation: 0.85,
    tint: [0.95, 0.95, 1.0]
  }
};

export const NeonPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 2.0,
    threshold: 0.3,
    radius: 1.0,
    iterations: 6
  },
  motionBlur: {
    enabled: true,
    intensity: 0.4,
    samples: 10
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.02  // RGB split on boost
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 48,
    stepSize: 0.06,
    thickness: 0.15
  },
  colorGrading: {
    enabled: true,
    contrast: 1.15,
    saturation: 1.3,
    tint: [1.0, 0.95, 1.05]
  }
};

export const StonePostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.2,
    threshold: 0.9,
    radius: 0.4,
    iterations: 3
  },
  motionBlur: {
    enabled: true,
    intensity: 0.2,
    samples: 6
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: false,
    maxSteps: 32,
    stepSize: 0.08,
    thickness: 0.2
  },
  colorGrading: {
    enabled: true,
    contrast: 1.05,
    saturation: 0.95,
    tint: [1.02, 1.0, 0.98]  // Slight warm tint
  }
};

// ============================================================================
// ENVIRONMENT & REFLECTION SYSTEM
// ============================================================================

export interface ReflectionProbeConfig {
  id?: string;
  resolution: number;
  updateMode: 'realtime' | 'onAwake' | 'scheduled';
  updateInterval: number;  // seconds for scheduled mode
  position: [number, number, number];
  near: number;
  far: number;
  cullingMask: string[];  // Layers to include in reflection
  intensity: number;
  priority?: number;
  zoneId?: string;
  parallaxBoxMin?: [number, number, number];
  parallaxBoxMax?: [number, number, number];
}

export type RenderingQualityProfileName = 'balanced' | 'high' | 'cinematic';

export interface RenderingQualityProfile {
  name: RenderingQualityProfileName;
  maxProbeUpdatesPerFrame: number;
  probeResolutionScale: number;
  ssrStepScale: number;
  bloomIterationCap: number;
  shadowMapResolution: number;
  lodHysteresisMeters: number;
}

export const RenderingQualityProfiles: Record<RenderingQualityProfileName, RenderingQualityProfile> = {
  balanced: {
    name: 'balanced',
    maxProbeUpdatesPerFrame: 1,
    probeResolutionScale: 0.75,
    ssrStepScale: 0.75,
    bloomIterationCap: 4,
    shadowMapResolution: 1024,
    lodHysteresisMeters: 1.0
  },
  high: {
    name: 'high',
    maxProbeUpdatesPerFrame: 2,
    probeResolutionScale: 1.0,
    ssrStepScale: 1.0,
    bloomIterationCap: 5,
    shadowMapResolution: 2048,
    lodHysteresisMeters: 1.5
  },
  cinematic: {
    name: 'cinematic',
    maxProbeUpdatesPerFrame: 4,
    probeResolutionScale: 1.5,
    ssrStepScale: 1.25,
    bloomIterationCap: 7,
    shadowMapResolution: 4096,
    lodHysteresisMeters: 2.0
  }
};

export interface ShadowConfig {
  enabled: boolean;
  mapResolution: number;
  cascadeCount: number;
  cascadeSplits: number[];
  bias: number;
  normalBias: number;
  softness: number;
  maxDistance: number;
}

export interface DirectionalLightConfig {
  enabled: boolean;
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  castShadows: boolean;
}

export interface TrackSurfaceVisualProperties {
  surfaceType?: 'obsidian' | 'ice' | 'rubber' | 'sand' | 'volcanic_rock' | 'crystal';
  roughnessOverride?: number;
  metallicOverride?: number;
  reflectionIntensity?: number;
  shadowIntensity?: number;
  shadowSoftness?: number;
}

export interface TrackZoneVisualMetadata {
  zoneId: string;
  surface: TrackSurfaceVisualProperties;
  reflectionProbeHint?: string;
}

export interface EnvironmentConfig {
  qualityProfile: RenderingQualityProfileName;
  iblIntensity: number;
  iblRotation: number;
  reflectionProbes: ReflectionProbeConfig[];
  directionalLight: DirectionalLightConfig;
  shadow: ShadowConfig;
  skybox: {
    enabled: boolean;
    texture: string | null;
    color: [number, number, number];
    exposure: number;
  };
}

export const DefaultEnvironmentConfig: EnvironmentConfig = {
  qualityProfile: 'high',
  iblIntensity: 1.0,
  iblRotation: 0.0,
  reflectionProbes: [
    {
      id: 'global_probe',
      resolution: 256,
      updateMode: 'realtime',
      updateInterval: 0.0,
      position: [0, 5, 0],
      near: 0.1,
      far: 100.0,
      cullingMask: ['marbles', 'environment'],
      intensity: 1.0,
      priority: 1
    }
  ],
  directionalLight: {
    enabled: true,
    direction: [1.0, 1.0, 0.5],
    color: [1.0, 0.97, 0.93],
    intensity: 1.0,
    castShadows: true
  },
  shadow: {
    enabled: true,
    mapResolution: 2048,
    cascadeCount: 3,
    cascadeSplits: [0.1, 0.35, 1.0],
    bias: 0.0008,
    normalBias: 0.1,
    softness: 0.7,
    maxDistance: 80.0
  },
  skybox: {
    enabled: true,
    texture: 'env_sky_cloudy.hdr',
    color: [0.5, 0.6, 0.7],
    exposure: 1.0
  }
};

// ============================================================================
// LOD & OPTIMIZATION CONFIGURATION
// ============================================================================

export interface LODLevel {
  distance: number;
  mesh: string;
  material: string;
  shadowCasting: boolean;
  receiveShadows: boolean;
}

export interface ImpostorConfig {
  enabled: boolean;
  distance: number;
  textureResolution: number;
  updateRate: number;  // Updates per second
  billboardMode: 'cylindrical' | 'spherical';
}

export interface InstancingConfig {
  enabled: boolean;
  maxInstances: number;
  frustumCulling: boolean;
  occlusionCulling: boolean;
  dynamicBatching: boolean;
}

export interface LODConfig {
  levels: LODLevel[];
  impostor: ImpostorConfig;
  instancing: InstancingConfig;
  lodFadeMode: 'crossFade' | 'speedTree' | 'none';
  lodFadeWidth: number;
}

export const DefaultMarbleLOD: LODConfig = {
  levels: [
    {
      distance: 0,
      mesh: 'marble_lod0_highpoly.glb',  // High detail
      material: 'marble_full',
      shadowCasting: true,
      receiveShadows: true
    },
    {
      distance: 10,
      mesh: 'marble_lod1_medium.glb',   // Reduced polygons
      material: 'marble_medium',
      shadowCasting: true,
      receiveShadows: true
    },
    {
      distance: 30,
      mesh: 'marble_lod2_low.glb',      // Low poly
      material: 'marble_low',
      shadowCasting: false,
      receiveShadows: true
    }
  ],
  impostor: {
    enabled: true,
    distance: 60,
    textureResolution: 128,
    updateRate: 10,
    billboardMode: 'spherical'
  },
  instancing: {
    enabled: true,
    maxInstances: 100,
    frustumCulling: true,
    occlusionCulling: true,
    dynamicBatching: true
  },
  lodFadeMode: 'crossFade',
  lodFadeWidth: 0.1
};

// ============================================================================
// MARBLE RENDERING FACTORY
// ============================================================================

export interface MarbleRenderingPackage {
  name: string;
  materialConfig: MarbleMaterialConfig;
  particleEffects: ParticleEffect[];
  postProcessConfig: PostProcessConfig;
  lodConfig: LODConfig;
}

export const ClassicGlassMarble: MarbleRenderingPackage = {
  name: 'ClassicGlass',
  materialConfig: GlassMaterialConfig,
  particleEffects: [SpeedSparkleEffect, ImpactBurstEffect],
  postProcessConfig: GlassPostProcess,
  lodConfig: DefaultMarbleLOD
};

export const ObsidianMetalMarble: MarbleRenderingPackage = {
  name: 'ObsidianMetal',
  materialConfig: ObsidianMaterialConfig,
  particleEffects: [SpeedSparkleEffect, ImpactBurstEffect],
  postProcessConfig: ObsidianPostProcess,
  lodConfig: DefaultMarbleLOD
};

export const NeonGlowMarble: MarbleRenderingPackage = {
  name: 'NeonGlow',
  materialConfig: NeonMaterialConfig,
  particleEffects: [NeonTrailEffect, BoostFlameEffect, ImpactBurstEffect],
  postProcessConfig: NeonPostProcess,
  lodConfig: DefaultMarbleLOD
};

export const StoneVeinMarble: MarbleRenderingPackage = {
  name: 'StoneVein',
  materialConfig: StoneMaterialConfig,
  particleEffects: [SpeedSparkleEffect],
  postProcessConfig: StonePostProcess,
  lodConfig: DefaultMarbleLOD
};

// All marbles collection
export const AllMarbleRenderingPackages: MarbleRenderingPackage[] = [
  ClassicGlassMarble,
  ObsidianMetalMarble,
  NeonGlowMarble,
  StoneVeinMarble
];

// ============================================================================
// FILAMENT MATERIAL BUILDER (TypeScript API)
// ============================================================================

/**
 * Creates a Filament Material from configuration
 * Note: This uses pseudo-API that mirrors Filament's actual interface
 */
export class FilamentMaterialBuilder {
  private config: MarbleMaterialConfig;

  constructor(config: MarbleMaterialConfig) {
    this.config = config;
  }

  /**
   * Build the material using Filament's Material.Builder
   */
  build(engine: any): any {
    // Pseudo-code for Filament.js API
    // In actual implementation, this would call Filament's C++ API

    const materialData = {
      name: this.config.name,
      vertexShader: this.config.vertexShader,
      fragmentShader: this.config.fragmentShader,
      uniforms: this.config.uniforms,
      blending: this.config.blending,
      depthWrite: this.config.depthWrite,
      cullFace: this.config.cullFace
    };

    // Return material creation parameters
    // Actual Filament code would be:
    // return new Filament.Material.Builder()
    //   .package(materialData)
    //   .build(engine);

    return materialData;
  }
}

/**
 * Creates a post-processing pipeline configuration
 */
export function createPostProcessPipeline(
  config: PostProcessConfig,
  engine: any,
  qualityProfile: RenderingQualityProfileName = 'high'
): any {
  const quality = RenderingQualityProfiles[qualityProfile];

  const bloomIterations = Math.min(config.bloom.iterations, quality.bloomIterationCap);
  const ssrSteps = Math.max(8, Math.floor(config.screenSpaceReflections.maxSteps * quality.ssrStepScale));

  // Pseudo-code for Filament View configuration
  return {
    bloom: config.bloom.enabled ? {
      levels: bloomIterations,
      intensity: config.bloom.intensity,
      threshold: config.bloom.threshold,
      resolution: 256 // Base resolution
    } : null,

    motionBlur: config.motionBlur.enabled ? {
      intensity: config.motionBlur.intensity,
      samples: config.motionBlur.samples
    } : null,

    chromaticAberration: config.chromaticAberration.enabled ? {
      intensity: config.chromaticAberration.intensity
    } : null,

    ssr: config.screenSpaceReflections.enabled ? {
      maxSteps: ssrSteps,
      stepSize: config.screenSpaceReflections.stepSize,
      thickness: config.screenSpaceReflections.thickness
    } : null,

    colorGrading: config.colorGrading.enabled ? {
      toneMapper: 'ACES',
      contrast: config.colorGrading.contrast,
      saturation: config.colorGrading.saturation,
      tint: config.colorGrading.tint
    } : null
  };
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/**
 * Example: Creating materials for all marble types
 */
export function createAllMarbleMaterials(engine: any): Map<string, any> {
  const materials = new Map<string, any>();

  for (const pkg of AllMarbleRenderingPackages) {
    const builder = new FilamentMaterialBuilder(pkg.materialConfig);
    const material = builder.build(engine);
    materials.set(pkg.name, material);
  }

  return materials;
}

/**
 * Example: Setting up post-processing for a marble type
 */
export function setupMarblePostProcessing(
  view: any,
  marbleType: string
): void {
  const pkg = AllMarbleRenderingPackages.find(p => p.name === marbleType);
  if (!pkg) return;

  const pipeline = createPostProcessPipeline(pkg.postProcessConfig, view.getEngine());

  // Apply to view
  // view.setPostProcessingEnabled(true);
  // view.setBloomOptions(pipeline.bloom);
  // view.setColorGrading(pipeline.colorGrading);
  // etc.
}

// Export all shader source strings for external use
export const ShaderSource = {
  vertex: MARBLE_VERTEX_SHADER,
  glassFragment: CLASSIC_GLASS_FRAGMENT_SHADER,
  obsidianFragment: OBSIDIAN_METAL_FRAGMENT_SHADER,
  neonFragment: NEON_GLOW_FRAGMENT_SHADER,
  stoneFragment: STONE_VEIN_FRAGMENT_SHADER
};
