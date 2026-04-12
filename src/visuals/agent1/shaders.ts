/**
 * Agent 1: Beauty Layer - Shader Sources
 * Marble Visual Overhaul Agent Swarm
 * @module agent1/shaders
 */

/**
 * Base vertex shader with support for all refined material features
 */
export const REFINED_VERTEX_SHADER = `
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

/**
 * Enhanced Classic Glass Fragment Shader
 * Features: Improved clear-coat, enhanced refraction, better rim lighting
 */
export const REFINED_GLASS_FRAGMENT_SHADER = `
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
`;

/**
 * Enhanced Obsidian Metal Fragment Shader
 * Features: Better anisotropic highlights, improved clear-coat, refined metal grain
 */
export const REFINED_OBSIDIAN_FRAGMENT_SHADER = `
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
export const REFINED_NEON_FRAGMENT_SHADER = `
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
export const REFINED_STONE_FRAGMENT_SHADER = `
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
export const QUANTUM_CRYSTAL_FRAGMENT_SHADER = `
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

// Export shader sources for external use
export const RefinedShaderSource = {
  vertex: REFINED_VERTEX_SHADER,
  glassFragment: REFINED_GLASS_FRAGMENT_SHADER,
  obsidianFragment: REFINED_OBSIDIAN_FRAGMENT_SHADER,
  neonFragment: REFINED_NEON_FRAGMENT_SHADER,
  stoneFragment: REFINED_STONE_FRAGMENT_SHADER,
  quantumCrystalFragment: QUANTUM_CRYSTAL_FRAGMENT_SHADER
};
