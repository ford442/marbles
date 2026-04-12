/**
 * Agent 3: Advanced Rendering Layer
 * Marble Visual Overhaul Agent Swarm
 * 
 * Next-generation custom shaders and effects including:
 * - Quantum entanglement visualization shaders
 * - Prismatic chromatic dispersion effects
 * - Volcanic lava glow with heat distortion
 * - Advanced particle systems
 * - Enhanced post-processing (DOF, vignette, film grain)
 * - Screen-space subsurface scattering
 * - Probe blending for zone transitions
 * 
 * Performance Budget: < 1.0ms per marble (high-quality shaders)
 * @module agent3_advanced_rendering
 */

// ============================================================================
// SHARED VERTEX SHADER (Advanced Features)
// ============================================================================

/**
 * Enhanced vertex shader with support for advanced distortion effects
 */
const ADVANCED_VERTEX_SHADER = `
#include "common_types.glsl"

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform float uTime;
uniform float uDistortionStrength;
uniform float uHeatDistortion;
uniform float uWaveAmplitude;

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
out vec4 vScreenPos;

// Heat wave distortion
vec3 heatDistortion(vec3 pos, float time, float strength) {
    float wave1 = sin(pos.x * 15.0 + time * 3.0) * cos(pos.y * 12.0 + time * 2.5);
    float wave2 = cos(pos.z * 10.0 + time * 2.0) * sin(pos.x * 8.0 + time * 1.5);
    return normal * (wave1 + wave2) * strength * 0.02;
}

// Quantum wave interference distortion
vec3 quantumDistortion(vec3 pos, float time, float amplitude) {
    float interference = sin(pos.x * 20.0 + time * 5.0) * 
                         sin(pos.y * 20.0 + time * 4.0) * 
                         sin(pos.z * 20.0 + time * 3.0);
    return normal * interference * amplitude;
}

void main() {
    vec3 pos = position;
    
    // Apply heat distortion for volcanic effect
    pos += heatDistortion(pos, uTime, uHeatDistortion);
    
    // Apply quantum wave distortion
    pos += quantumDistortion(pos, uTime, uWaveAmplitude);
    
    // General vertex distortion
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
    vScreenPos = projectionMatrix * viewPosition;
    
    // Transform normal basis to world space
    vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = normalize((normalMatrix * vec4(tangent, 0.0)).xyz);
    vBitangent = cross(vNormal, vTangent);
    
    vUv = uv;
    
    // Pre-calculate fresnel
    vec3 viewDir = normalize(vViewDirection);
    vFresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
    
    gl_Position = projectionMatrix * viewPosition;
}
`;

// ============================================================================
// QUANTUM MARBLE SHADER
// ============================================================================

/**
 * Quantum Marble Fragment Shader
 * Features: Wave interference patterns, probability clouds, energy pulse effects,
 *           quantum entanglement visualization, superposition states
 * 
 * Performance: ~0.4ms on mid-tier GPU
 */
const QUANTUM_MARBLE_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D noiseTexture;
uniform sampler2D quantumPatternTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uWaveSpeed;
uniform float uProbabilityCloudDensity;
uniform float uEnergyPulseIntensity;
uniform float uEntanglementGlow;
uniform float uSuperpositionBlend;
uniform vec3 uQuantumColorA;
uniform vec3 uQuantumColorB;
uniform float uMetallic;
uniform float uRoughness;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vDepth;
in float vFresnel;

out vec4 fragColor;
out vec4 bloomColor;

// Quantum wave function - probability amplitude
float waveFunction(vec3 pos, float time, float frequency) {
    float psi = 0.0;
    
    // Real part
    float real = sin(pos.x * frequency + time * uWaveSpeed) * 
                 cos(pos.y * frequency * 0.7 + time * uWaveSpeed * 0.8);
    
    // Imaginary part
    float imag = cos(pos.z * frequency * 0.8 + time * uWaveSpeed * 0.6) * 
                 sin(pos.x * frequency * 1.2 - time * uWaveSpeed * 0.9);
    
    // Probability amplitude |ψ|²
    psi = real * real + imag * imag;
    
    return psi;
}

// Interference pattern from multiple quantum sources
float interferencePattern(vec3 pos, float time) {
    float interference = 0.0;
    
    // Source 1
    float d1 = length(pos - vec3(0.3, 0.0, 0.0));
    float wave1 = sin(d1 * 20.0 - time * uWaveSpeed) / (d1 + 0.1);
    
    // Source 2
    float d2 = length(pos - vec3(-0.3, 0.0, 0.0));
    float wave2 = sin(d2 * 20.0 - time * uWaveSpeed + 3.14159) / (d2 + 0.1);
    
    // Source 3
    float d3 = length(pos - vec3(0.0, 0.4, 0.0));
    float wave3 = sin(d3 * 15.0 - time * uWaveSpeed * 0.7) / (d3 + 0.1);
    
    interference = wave1 + wave2 + wave3;
    return interference * 0.5 + 0.5;
}

// Probability cloud visualization
vec3 probabilityCloud(vec3 pos, float time) {
    vec3 cloud = vec3(0.0);
    
    // Layer 1: Electron orbital-like patterns
    float orbital1 = waveFunction(pos * 2.0, time, 8.0);
    orbital1 = pow(orbital1, 2.0) * uProbabilityCloudDensity;
    cloud += uQuantumColorA * orbital1;
    
    // Layer 2: Higher energy state
    float orbital2 = waveFunction(pos * 3.0 + vec3(1.0), time * 1.3, 12.0);
    orbital2 = pow(orbital2, 1.5) * uProbabilityCloudDensity * 0.7;
    cloud += uQuantumColorB * orbital2;
    
    // Layer 3: Ground state glow
    float ground = exp(-length(pos) * 3.0);
    cloud += mix(uQuantumColorA, uQuantumColorB, 0.5) * ground * 0.5;
    
    return cloud;
}

// Energy pulse effect
float energyPulse(vec3 pos, float time) {
    float pulse = 0.0;
    
    // Radial pulse from center
    float dist = length(pos);
    float radialPulse = sin(dist * 15.0 - time * 8.0) * 0.5 + 0.5;
    radialPulse *= exp(-dist * 2.0);
    
    // Harmonic overtones
    float harmonic = sin(dist * 30.0 - time * 12.0) * 0.5 + 0.5;
    harmonic *= exp(-dist * 4.0) * 0.5;
    
    // Phase coherence pulse
    float coherence = sin(time * 3.0) * 0.5 + 0.5;
    
    pulse = (radialPulse + harmonic) * coherence * uEnergyPulseIntensity;
    
    return pulse;
}

// Quantum entanglement glow - linked particles effect
float entanglementGlow(vec3 pos, float time) {
    float glow = 0.0;
    
    // Simulate entangled pairs
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec3 pairPos = vec3(
            sin(fi * 1.047 + time * 0.5) * 0.4,
            cos(fi * 0.785 + time * 0.3) * 0.4,
            sin(fi * 1.309 + time * 0.4) * 0.3
        );
        
        float dist = length(pos - pairPos);
        float connection = sin(time * 5.0 + fi) * 0.5 + 0.5;
        
        glow += exp(-dist * 8.0) * connection * 0.5;
    }
    
    return glow * uEntanglementGlow;
}

// Schrödinger equation inspired pattern
float schrodingerPattern(vec2 uv, float time) {
    float pattern = 0.0;
    
    // Wave packet
    float packet = exp(-pow(uv.x - 0.5, 2.0) * 20.0);
    float wave = sin(uv.x * 50.0 - time * 10.0) * packet;
    
    // Uncertainty visualization
    float uncertainty = sin(uv.y * 30.0 + time * 3.0) * 
                        cos(uv.x * 25.0 - time * 2.5);
    
    pattern = wave * uncertainty * 0.5 + 0.5;
    return pattern;
}

// Superposition state visualization
vec3 superpositionState(vec3 pos, float time, float blend) {
    vec3 stateA = uQuantumColorA * (sin(pos.x * 10.0 + time) * 0.5 + 0.5);
    vec3 stateB = uQuantumColorB * (cos(pos.y * 10.0 + time * 1.2) * 0.5 + 0.5);
    
    // Quantum superposition: |ψ⟩ = α|A⟩ + β|B⟩
    float alpha = sin(time * 2.0) * 0.5 + 0.5;
    float beta = sqrt(1.0 - alpha * alpha);
    
    return mix(stateA * alpha + stateB * beta, (stateA + stateB) * 0.5, blend);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Base quantum interference
    float interference = interferencePattern(vWorldPosition, uTime);
    
    // Probability cloud
    vec3 cloud = probabilityCloud(vWorldPosition, uTime);
    
    // Energy pulse
    float pulse = energyPulse(vWorldPosition, uTime);
    
    // Entanglement glow
    float entangle = entanglementGlow(vWorldPosition, uTime);
    
    // Superposition state
    vec3 superposition = superpositionState(vWorldPosition, uTime, uSuperpositionBlend);
    
    // Schrödinger pattern overlay
    float schrodinger = schrodingerPattern(vUv, uTime);
    
    // Fresnel for quantum rim effect
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
    
    // Environment reflection
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    
    // Combine quantum effects
    vec3 quantumColor = cloud;
    quantumColor += uQuantumColorA * pulse * 0.8;
    quantumColor += uQuantumColorB * entangle * 0.6;
    quantumColor += superposition * interference * 0.5;
    quantumColor += mix(uQuantumColorA, uQuantumColorB, schrodinger) * schrodinger * 0.3;
    
    // Add reflection with metallic factor
    quantumColor += reflection * uMetallic * (0.3 + interference * 0.4);
    
    // Quantum rim glow
    vec3 rimColor = mix(uQuantumColorA, uQuantumColorB, sin(uTime) * 0.5 + 0.5);
    quantumColor += rimColor * fresnel * 2.0 * vFresnel;
    
    // Uncertainty shimmer
    float shimmer = sin(vWorldPosition.x * 100.0 + uTime * 10.0) * 
                    cos(vWorldPosition.y * 100.0 + uTime * 8.0);
    quantumColor += rimColor * shimmer * 0.1 * fresnel;
    
    // Bloom contribution
    vec3 bloom = quantumColor;
    float luminance = dot(bloom, vec3(0.299, 0.587, 0.114));
    bloom = mix(vec3(0.0), bloom, smoothstep(0.3, 0.9, luminance));
    bloom += rimColor * fresnel * 0.5;
    bloom += uQuantumColorA * pulse * 0.3;
    
    fragColor = vec4(quantumColor, 0.95);
    bloomColor = vec4(bloom, 1.0);
}
`;

// ============================================================================
// PRISMATIC MARBLE SHADER
// ============================================================================

/**
 * Prismatic Marble Fragment Shader
 * Features: Chromatic dispersion, light splitting, rainbow caustics,
 *           dispersion-based IOR, spectral refraction
 * 
 * Performance: ~0.45ms on mid-tier GPU
 */
const PRISMATIC_MARBLE_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D dispersionTexture;
uniform sampler2D causticTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uDispersionStrength;
uniform float uIorRed;
uniform float uIorGreen;
uniform float uIorBlue;
uniform float uCausticIntensity;
uniform float uRainbowSpeed;
uniform float uSpectralShift;
uniform float uPrismaticSparkle;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vDepth;
in float vFresnel;

out vec4 fragColor;
out vec4 bloomColor;

// Spectral colors - CIE 1931 RGB approximation
vec3 spectralColor(float wavelength) {
    // Map 380-780nm to RGB
    vec3 color;
    
    if (wavelength < 420.0) {
        color = vec3(0.3, 0.0, 0.5 + (wavelength - 380.0) / 80.0);
    } else if (wavelength < 490.0) {
        color = vec3(0.0, (wavelength - 420.0) / 70.0, 1.0);
    } else if (wavelength < 580.0) {
        color = vec3((wavelength - 490.0) / 90.0, 1.0, 1.0 - (wavelength - 490.0) / 90.0);
    } else if (wavelength < 645.0) {
        color = vec3(1.0, 1.0 - (wavelength - 580.0) / 65.0, 0.0);
    } else {
        color = vec3(1.0 - (wavelength - 645.0) / 135.0 * 0.5, 0.0, 0.0);
    }
    
    return color;
}

// Cauchy's equation for wavelength-dependent IOR
float cauchyIOR(float wavelength, float A, float B) {
    // IOR = A + B / wavelength²
    return A + B / (wavelength * wavelength * 1e-6);
}

// Chromatic refraction with full spectrum
vec3 chromaticRefraction(vec3 viewDir, vec3 normal, float baseIOR, float dispersion) {
    vec3 refracted = vec3(0.0);
    
    // Sample key wavelengths
    float wavelengths[7];
    wavelengths[0] = 380.0; // Violet
    wavelengths[1] = 450.0; // Blue
    wavelengths[2] = 495.0; // Cyan
    wavelengths[3] = 570.0; // Yellow
    wavelengths[4] = 590.0; // Orange
    wavelengths[5] = 620.0; // Red
    wavelengths[6] = 750.0; // Deep red
    
    vec3 accumulation = vec3(0.0);
    float weights[7];
    weights[0] = 0.15; weights[1] = 0.15; weights[2] = 0.15;
    weights[3] = 0.15; weights[4] = 0.15; weights[5] = 0.15; weights[6] = 0.1;
    
    for (int i = 0; i < 7; i++) {
        float ior = cauchyIOR(wavelengths[i], baseIOR, dispersion * 1000.0);
        vec3 refractDir = refract(-viewDir, normal, 1.0 / ior);
        vec3 sampleColor = texture(envMap, refractDir).rgb;
        vec3 spectral = spectralColor(wavelengths[i]);
        accumulation += sampleColor * spectral * weights[i];
    }
    
    return accumulation * 3.0; // Boost for visibility
}

// Simplified RGB-based chromatic aberration
vec3 rgbChromaticRefraction(vec3 viewDir, vec3 normal, float iorR, float iorG, float iorB) {
    vec3 refractR = refract(-viewDir, normal, 1.0 / iorR);
    vec3 refractG = refract(-viewDir, normal, 1.0 / iorG);
    vec3 refractB = refract(-viewDir, normal, 1.0 / iorB);
    
    vec3 color;
    color.r = texture(envMap, refractR).r;
    color.g = texture(envMap, refractG).g;
    color.b = texture(envMap, refractB).b;
    
    return color;
}

// Rainbow caustic pattern
vec3 rainbowCaustics(vec3 pos, float time) {
    vec3 caustic = vec3(0.0);
    
    // Layered caustic patterns with color shift
    vec3 p1 = pos * 3.0 + vec3(time * 0.5, time * 0.3, 0.0);
    float c1 = sin(p1.x * 5.0) * cos(p1.y * 4.0) * sin(p1.z * 3.0);
    
    vec3 p2 = pos * 5.0 - vec3(time * 0.3, time * 0.5, time * 0.2);
    float c2 = cos(p2.x * 7.0) * sin(p2.y * 6.0) * cos(p2.z * 5.0);
    
    // Spectral rainbow based on position
    float rainbowPhase = pos.x * 2.0 + pos.y * 1.5 + time * uRainbowSpeed;
    vec3 rainbow;
    rainbow.r = sin(rainbowPhase) * 0.5 + 0.5;
    rainbow.g = sin(rainbowPhase + 2.094) * 0.5 + 0.5;
    rainbow.b = sin(rainbowPhase + 4.189) * 0.5 + 0.5;
    
    caustic = rainbow * (c1 * 0.5 + 0.5) * (c2 * 0.3 + 0.7);
    caustic = pow(caustic, vec3(1.5)) * uCausticIntensity;
    
    return caustic;
}

// Prismatic sparkle - spectral glints
float prismaticSparkle(vec3 pos, vec3 normal, vec3 viewDir, float time) {
    float sparkle = 0.0;
    
    // Multiple microfacet angles for spectral separation
    vec3 sparklePos = pos * 80.0;
    
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float offset = fi * 1.256;
        
        float s = sin(sparklePos.x * (10.0 + fi * 2.0) + offset);
        s += cos(sparklePos.y * (12.0 + fi * 3.0) + offset * 1.3);
        s += sin(sparklePos.z * (8.0 + fi * 2.5) + offset * 0.7);
        
        // Spectral sparkle color based on angle
        float spectral = sin(atan(normal.y, normal.x) * 5.0 + fi + time) * 0.5 + 0.5;
        
        sparkle += step(0.95 + fi * 0.01, fract(s * 43758.5453)) * spectral;
    }
    
    // View-dependent intensity
    float viewFactor = 1.0 - abs(dot(viewDir, normal));
    
    return sparkle * viewFactor * uPrismaticSparkle;
}

// Light dispersion through internal reflections
vec3 internalDispersion(vec3 pos, vec3 viewDir, vec3 normal, float time) {
    vec3 dispersion = vec3(0.0);
    
    // Simulate light bouncing inside the marble
    vec3 internalDir = reflect(-viewDir, normal);
    
    // Spectral separation on exit
    float exitAngle = dot(internalDir, normal);
    float spectralSpread = (exitAngle + 1.0) * 0.5;
    
    // Color based on exit angle
    dispersion.r = smoothstep(0.0, 0.3, spectralSpread);
    dispersion.g = smoothstep(0.2, 0.6, spectralSpread) * (1.0 - smoothstep(0.6, 0.8, spectralSpread));
    dispersion.b = smoothstep(0.5, 1.0, spectralSpread);
    
    // Animated spectral shift
    float shift = sin(time * uRainbowSpeed + pos.x * 3.0) * 0.2;
    dispersion = mix(dispersion, dispersion.gbr, shift + 0.5);
    
    return dispersion * uDispersionStrength;
}

// Fresnel with spectral variation
vec3 spectralFresnel(vec3 viewDir, vec3 normal, float power) {
    float f = pow(1.0 - abs(dot(viewDir, normal)), power);
    
    // Spectral fresnel colors
    vec3 spectral;
    spectral.r = f * 1.2;
    spectral.g = f * f * 1.5;
    spectral.b = f * f * f * 2.0;
    
    return spectral;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Chromatic refraction
    vec3 refractedColor = rgbChromaticRefraction(viewDir, normal, uIorRed, uIorGreen, uIorBlue);
    
    // Full spectral refraction
    vec3 spectralRefraction = chromaticRefraction(viewDir, normal, (uIorRed + uIorGreen + uIorBlue) / 3.0, uDispersionStrength);
    
    // Blend between RGB and spectral
    refractedColor = mix(refractedColor, spectralRefraction, uSpectralShift);
    
    // Rainbow caustics
    vec3 caustics = rainbowCaustics(vWorldPosition, uTime);
    
    // Internal dispersion
    vec3 internal = internalDispersion(vWorldPosition, viewDir, normal, uTime);
    
    // Prismatic sparkle
    float sparkle = prismaticSparkle(vWorldPosition, normal, viewDir, uTime);
    vec3 sparkleColor = vec3(sparkle * 1.5, sparkle * 1.2, sparkle);
    
    // Reflection
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    
    // Spectral fresnel
    vec3 fresnelColor = spectralFresnel(viewDir, normal, 2.0);
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    
    // Combine all prismatic effects
    vec3 finalColor = refractedColor * 0.7;
    finalColor += reflection * fresnel * fresnelColor * 0.5;
    finalColor += caustics * (1.0 - fresnel);
    finalColor += internal * 0.4;
    finalColor += sparkleColor;
    
    // Spectral rim
    vec3 rainbowRim;
    float rimPhase = vFresnel * 3.14159 * 2.0 + uTime * uRainbowSpeed;
    rainbowRim.r = sin(rimPhase) * 0.5 + 0.5;
    rainbowRim.g = sin(rimPhase + 2.094) * 0.5 + 0.5;
    rainbowRim.b = sin(rimPhase + 4.189) * 0.5 + 0.5;
    finalColor += rainbowRim * vFresnel * 1.5;
    
    // Bloom contribution
    vec3 bloom = finalColor;
    bloom += sparkleColor * 0.8;
    bloom += rainbowRim * vFresnel * 0.5;
    float luminance = dot(bloom, vec3(0.299, 0.587, 0.114));
    bloom = mix(vec3(0.0), bloom, smoothstep(0.4, 0.85, luminance));
    
    fragColor = vec4(finalColor, 0.9 + fresnel * 0.1);
    bloomColor = vec4(bloom, 1.0);
}
`;

// ============================================================================
// VOLCANIC MARBLE SHADER
// ============================================================================

/**
 * Volcanic Marble Fragment Shader
 * Features: Lava glow with heat distortion, emissive cracks, flowing magma patterns,
 *           thermal pulses, ash and soot accumulation
 * 
 * Performance: ~0.5ms on mid-tier GPU
 */
const VOLCANIC_MARBLE_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D lavaTexture;
uniform sampler2D crackTexture;
uniform sampler2D noiseTexture;
uniform sampler2D emberTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uLavaFlowSpeed;
uniform float uHeatIntensity;
uniform float uCrackEmissive;
uniform float uMagmaViscosity;
uniform float uThermalPulse;
uniform float uAshCoverage;
uniform vec3 uLavaColor;
uniform vec3 uAshColor;
uniform float uGlowRadius;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vDepth;
in float vFresnel;

out vec4 fragColor;
out vec4 bloomColor;

// Fractal Brownian Motion for organic lava flow
float fbm(vec2 p, float time) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 5; i++) {
        value += amplitude * sin(p.x * frequency + time) * cos(p.y * frequency + time * 0.7);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value * 0.5 + 0.5;
}

// Turbulent lava flow
vec3 lavaFlow(vec2 uv, vec3 worldPos, float time) {
    vec3 lava = vec3(0.0);
    
    // Base flow direction with turbulence
    vec2 flowDir = normalize(vec2(0.3, -0.8)) * uLavaFlowSpeed;
    
    // Layer 1: Primary magma flow
    vec2 uv1 = uv + flowDir * time;
    float turbulence1 = fbm(uv1 * 4.0, time * 0.5);
    vec2 distortedUV1 = uv1 + vec2(
        sin(uv1.y * 8.0 + time) * 0.1,
        cos(uv1.x * 6.0 + time * 0.8) * 0.1
    ) * turbulence1;
    
    float flow1 = fbm(distortedUV1 * 3.0, time * 0.3);
    flow1 = pow(flow1, 2.0) * uHeatIntensity;
    
    // Layer 2: Secondary slower flow
    vec2 uv2 = uv * 1.5 + flowDir * time * 0.6 + vec2(0.5);
    float turbulence2 = fbm(uv2 * 6.0, time * 0.4);
    float flow2 = fbm(uv2 * 5.0 + turbulence2, time * 0.2);
    flow2 = pow(flow2, 3.0) * uHeatIntensity * 0.7;
    
    // Layer 3: Viscous pools
    vec2 uv3 = uv * 0.8 + vec2(sin(time * 0.2) * 0.1, cos(time * 0.15) * 0.1);
    float pool = fbm(uv3 * 2.0, time * 0.1);
    pool = smoothstep(0.4, 0.8, pool) * uMagmaViscosity;
    
    // Color temperatures
    vec3 hotColor = vec3(1.0, 0.9, 0.3);     // Yellow-white
    vec3 warmColor = vec3(1.0, 0.4, 0.05);   // Orange
    vec3 coolColor = vec3(0.8, 0.1, 0.0);    // Red
    
    lava += hotColor * flow1 * flow1;
    lava += warmColor * flow2;
    lava += coolColor * pool * 0.5;
    
    return lava * uLavaColor;
}

// Crack network with emissive lava
float crackPattern(vec2 uv, vec3 worldPos, float time) {
    float cracks = 0.0;
    
    // Large structural cracks
    vec2 p1 = uv * 6.0 + worldPos.xz * 0.3;
    float c1 = sin(p1.x * 2.0 + sin(p1.y * 3.0 + time * 0.1)) * 0.5 + 0.5;
    c1 = smoothstep(0.62, 0.68, c1);
    
    // Medium thermal cracks
    vec2 p2 = uv * 12.0 - time * 0.05;
    float c2 = sin(p2.y * 3.0 + cos(p2.x * 2.5)) * sin(p2.x * 4.0);
    c2 = smoothstep(0.7, 0.8, c2 * 0.5 + 0.5) * 0.6;
    
    // Fine surface cracking
    vec2 p3 = uv * 24.0 + worldPos.y * 2.0;
    float c3 = sin(p3.x * 5.0) * cos(p3.y * 4.0) * 0.5 + 0.5;
    c3 = pow(c3, 12.0) * 0.3;
    
    // Dynamic crack widening based on thermal pulse
    float pulse = sin(time * 0.8 + worldPos.y * 3.0) * 0.5 + 0.5;
    pulse = pow(pulse, 2.0) * uThermalPulse;
    
    cracks = (c1 + c2 + c3) * (1.0 + pulse * 0.5);
    
    return min(cracks, 1.0);
}

// Thermal pulse - periodic heating/cooling
float thermalPulse(vec3 worldPos, float time) {
    // Main pulse
    float pulse = sin(time * 1.2 + worldPos.y * 2.0) * 0.5 + 0.5;
    
    // Harmonic overtones
    float harmonic1 = sin(time * 2.4 + worldPos.x * 1.5) * 0.25 + 0.25;
    float harmonic2 = sin(time * 3.6 + worldPos.z * 2.0) * 0.15 + 0.15;
    
    // Local hot spots
    float hotSpot = sin(worldPos.x * 5.0) * cos(worldPos.z * 4.0) * 0.5 + 0.5;
    hotSpot = pow(hotSpot, 4.0) * 0.3;
    
    return (pulse + harmonic1 + harmonic2 + hotSpot) * uThermalPulse;
}

// Ash and soot accumulation
float ashAccumulation(vec2 uv, vec3 worldPos, float time) {
    float ash = 0.0;
    
    // Procedural ash texture
    vec2 ashUV = uv * 8.0 + vec2(time * 0.02, time * 0.01);
    float ashNoise = fbm(ashUV, time * 0.1);
    
    // Ash collects in crevices
    float crevice = sin(worldPos.x * 10.0) * cos(worldPos.z * 8.0) * 0.5 + 0.5;
    crevice = pow(crevice, 3.0);
    
    // Weathering pattern
    float weather = sin(uv.x * 20.0 + uv.y * 15.0) * 0.5 + 0.5;
    weather = smoothstep(0.3, 0.7, weather);
    
    ash = ashNoise * crevice * weather * uAshCoverage;
    
    return ash;
}

// Floating embers
vec3 floatingEmbers(vec2 uv, vec3 worldPos, float time) {
    vec3 embers = vec3(0.0);
    
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        
        // Ember position with upward drift
        vec2 emberPos = vec2(
            sin(fi * 1.3 + time * 0.5 + worldPos.x) * 0.4,
            mod(fi * 0.2 + time * 0.3 + worldPos.y * 0.5, 1.0) - 0.5
        );
        
        vec2 diff = uv - 0.5 - emberPos;
        float dist = length(diff);
        
        // Ember glow
        float size = 0.015 + 0.025 * fract(fi * 0.7);
        float glow = smoothstep(size, size * 0.3, dist);
        
        // Flicker
        float flicker = sin(time * 10.0 + fi * 2.0) * 0.3 + 0.7;
        flicker *= sin(time * 23.0 + fi) * 0.2 + 0.8;
        
        // Ember color (yellow to orange)
        vec3 emberColor = mix(
            vec3(1.0, 0.8, 0.1),
            vec3(1.0, 0.4, 0.0),
            fract(fi * 0.4)
        );
        
        embers += emberColor * glow * flicker * 0.5;
    }
    
    return embers;
}

// Heat distortion for surrounding air
float heatDistortion(vec2 uv, float time) {
    vec2 p = uv * 15.0 + vec2(0.0, time * 2.0);
    float distortion = sin(p.x) * cos(p.y);
    distortion += sin(p.x * 2.0 - time) * cos(p.y * 1.5) * 0.5;
    return distortion * 0.5 + 0.5;
}

// Magma bubble formation
float magmaBubbles(vec2 uv, vec3 worldPos, float time) {
    float bubbles = 0.0;
    
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        
        // Bubble position
        vec2 bubbleCenter = vec2(
            sin(fi * 2.5 + time * 0.4) * 0.3,
            cos(fi * 1.8 + time * 0.3) * 0.3
        );
        
        // Bubble growth
        float growth = sin(time * 2.0 + fi) * 0.5 + 0.5;
        growth = smoothstep(0.3, 0.7, growth);
        
        float dist = length(uv - 0.5 - bubbleCenter);
        float size = 0.02 + 0.04 * growth;
        
        float bubble = smoothstep(size, size * 0.5, dist) * growth;
        bubbles += bubble;
    }
    
    return bubbles * uMagmaViscosity;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Base volcanic rock
    vec3 rockColor = vec3(0.12, 0.08, 0.06);
    
    // Lava flow
    vec3 lava = lavaFlow(vUv, vWorldPosition, uTime);
    
    // Crack pattern
    float cracks = crackPattern(vUv, vWorldPosition, uTime);
    vec3 crackGlow = uLavaColor * cracks * uCrackEmissive * 3.0;
    
    // Thermal pulse effect
    float thermal = thermalPulse(vWorldPosition, uTime);
    vec3 thermalGlow = uLavaColor * thermal * 0.5;
    
    // Ash accumulation
    float ash = ashAccumulation(vUv, vWorldPosition, uTime);
    vec3 ashLayer = uAshColor * ash;
    
    // Floating embers
    vec3 embers = floatingEmbers(vUv, vWorldPosition, uTime);
    
    // Magma bubbles
    float bubbles = magmaBubbles(vUv, vWorldPosition, uTime);
    vec3 bubbleGlow = vec3(1.0, 0.5, 0.1) * bubbles * 2.0;
    
    // Fresnel heat glow
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
    vec3 heatGlow = uLavaColor * fresnel * uHeatIntensity * 2.0;
    
    // Surface roughness
    float roughness = mix(0.9, 0.3, cracks * 0.7);
    
    // Lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Specular on molten areas
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0 / roughness);
    vec3 specColor = vec3(1.0, 0.7, 0.4) * spec * cracks * 0.5;
    
    // Combine all layers
    vec3 finalColor = rockColor * (0.2 + 0.8 * diff);
    finalColor = mix(finalColor, lava, smoothstep(0.2, 0.8, length(lava))));
    finalColor += crackGlow;
    finalColor += thermalGlow;
    finalColor = mix(finalColor, ashLayer, ash * 0.7);
    finalColor += embers;
    finalColor += bubbleGlow;
    finalColor += heatGlow;
    finalColor += specColor;
    
    // Ambient occlusion in cracks
    float ao = 1.0 - cracks * 0.3;
    finalColor *= ao;
    
    // Environment reflection (very subtle)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    finalColor += reflection * 0.03 * (1.0 - ash * 0.5);
    
    // Bloom calculation
    vec3 bloom = crackGlow * 0.8;
    bloom += thermalGlow * 0.6;
    bloom += embers * 0.9;
    bloom += bubbleGlow * 0.5;
    bloom += heatGlow * 0.4;
    
    fragColor = vec4(finalColor, 1.0);
    bloomColor = vec4(bloom, 1.0);
}
`;

// ============================================================================
// ADVANCED PARTICLE SYSTEMS
// ============================================================================

/**
 * Particle effect configuration interface
 */
export interface AdvancedParticleEffect {
  name: string;
  maxParticles: number;
  emissionRate: number;
  lifetime: { min: number; max: number };
  size: { start: number; end: number; variation?: number };
  color: { 
    start: [number, number, number, number]; 
    end: [number, number, number, number];
    gradient?: [number, number, number, number][];
  };
  velocity: { 
    type: 'radial' | 'directional' | 'burst' | 'orbital' | 'entangled'; 
    speed: number; 
    spread: number;
    direction?: [number, number, number];
  };
  acceleration: [number, number, number];
  rotation: { start: number; speed: number; randomize: boolean };
  texture: string;
  blending: 'additive' | 'normal' | 'screen';
  trigger: 'speed' | 'impact' | 'boost' | 'continuous' | 'quantum_entangle';
  triggerThreshold?: number;
  
  // Advanced features
  quantumEntanglement?: {
    enabled: boolean;
    pairDistance: number;
    syncPhase: boolean;
  };
  heatShimmer?: {
    enabled: boolean;
    intensity: number;
    speed: number;
  };
  spectralShift?: {
    enabled: boolean;
    speed: number;
    range: number;
  };
}

/**
 * Quantum Entanglement Particles
 * Linked particle pairs that react across distance
 * 
 * Performance: ~0.1ms per 100 particles
 */
export const QuantumEntanglementParticles: AdvancedParticleEffect = {
  name: 'QuantumEntanglement',
  maxParticles: 300,
  emissionRate: 60,
  lifetime: { min: 1.0, max: 2.5 },
  size: { start: 0.08, end: 0.02, variation: 0.5 },
  color: {
    start: [0.45, 0.12, 0.85, 0.9],
    end: [0.0, 0.95, 1.0, 0.0],
    gradient: [
      [0.45, 0.12, 0.85, 0.9],
      [0.95, 0.0, 0.65, 0.7],
      [0.0, 0.95, 1.0, 0.4],
      [0.0, 0.0, 0.0, 0.0]
    ]
  },
  velocity: {
    type: 'entangled',
    speed: 3.0,
    spread: 0.4
  },
  acceleration: [0, 0, 0],
  rotation: { start: 0, speed: 90, randomize: true },
  texture: 'particle_quantum_wisp.png',
  blending: 'additive',
  trigger: 'quantum_entangle',
  
  quantumEntanglement: {
    enabled: true,
    pairDistance: 2.0,
    syncPhase: true
  }
};

/**
 * Prismatic Sparkles
 * Rainbow sparkle effects with chromatic dispersion
 * 
 * Performance: ~0.08ms per 100 particles
 */
export const PrismaticSparkles: AdvancedParticleEffect = {
  name: 'PrismaticSparkles',
  maxParticles: 200,
  emissionRate: 0, // Speed-based emission
  lifetime: { min: 0.3, max: 0.8 },
  size: { start: 0.06, end: 0.0, variation: 0.3 },
  color: {
    start: [1.0, 1.0, 1.0, 1.0],
    end: [0.8, 0.8, 1.0, 0.0]
  },
  velocity: {
    type: 'radial',
    speed: 4.0,
    spread: 1.0
  },
  acceleration: [0, -1.5, 0],
  rotation: { start: 0, speed: 180, randomize: true },
  texture: 'particle_prismatic_sparkle.png',
  blending: 'additive',
  trigger: 'speed',
  triggerThreshold: 3.0,
  
  spectralShift: {
    enabled: true,
    speed: 5.0,
    range: 1.0
  }
};

/**
 * Volcanic Ember Trails
 * Floating ember particles with heat shimmer
 * 
 * Performance: ~0.12ms per 100 particles
 */
export const VolcanicEmberTrails: AdvancedParticleEffect = {
  name: 'VolcanicEmberTrails',
  maxParticles: 250,
  emissionRate: 45,
  lifetime: { min: 0.8, max: 1.8 },
  size: { start: 0.12, end: 0.04, variation: 0.6 },
  color: {
    start: [1.0, 0.8, 0.2, 0.9],
    end: [0.6, 0.1, 0.0, 0.0],
    gradient: [
      [1.0, 0.9, 0.3, 0.9],
      [1.0, 0.5, 0.05, 0.7],
      [0.8, 0.2, 0.0, 0.4],
      [0.3, 0.05, 0.0, 0.0]
    ]
  },
  velocity: {
    type: 'directional',
    speed: 2.5,
    spread: 0.6,
    direction: [0, 1, 0]
  },
  acceleration: [0, 1.2, 0],
  rotation: { start: 0, speed: 60, randomize: false },
  texture: 'particle_ember_glow.png',
  blending: 'additive',
  trigger: 'continuous',
  
  heatShimmer: {
    enabled: true,
    intensity: 0.15,
    speed: 3.0
  }
};

// ============================================================================
// MATERIAL CONFIGURATIONS
// ============================================================================

/**
 * Advanced material configuration interface with performance annotations
 */
export interface AdvancedMaterialConfig {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { type: string; value: any }>;
  blending: 'opaque' | 'transparent' | 'additive';
  depthWrite: boolean;
  cullFace: 'front' | 'back' | 'none';
  
  // Performance annotations
  performance: {
    estimatedGpuCost: number; // milliseconds
    qualityTier: 'low' | 'medium' | 'high' | 'ultra';
    textureCount: number;
    uniformCount: number;
    instructionEstimate: number;
    targetPlatform: 'mobile' | 'desktop' | 'universal';
  };
  
  // Feature flags
  features: {
    requiresBloom: boolean;
    requiresSSS: boolean;
    requiresSSR: boolean;
    supportsInstancing: boolean;
    supportsLOD: boolean;
  };
}

/**
 * Quantum Marble Material Configuration
 * 
 * @performance ~0.4ms GPU time (high-tier desktop)
 * @features Wave interference, probability clouds, entanglement glow
 */
export const QuantumMarbleConfig: AdvancedMaterialConfig = {
  name: 'QuantumMarble',
  vertexShader: ADVANCED_VERTEX_SHADER,
  fragmentShader: QUANTUM_MARBLE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uWaveSpeed: { type: 'float', value: 3.0 },
    uProbabilityCloudDensity: { type: 'float', value: 0.8 },
    uEnergyPulseIntensity: { type: 'float', value: 1.2 },
    uEntanglementGlow: { type: 'float', value: 0.6 },
    uSuperpositionBlend: { type: 'float', value: 0.4 },
    uQuantumColorA: { type: 'vec3', value: [0.45, 0.12, 0.85] },
    uQuantumColorB: { type: 'vec3', value: [0.0, 0.95, 1.0] },
    uMetallic: { type: 'float', value: 0.4 },
    uRoughness: { type: 'float', value: 0.3 },
    uDistortionStrength: { type: 'float', value: 0.02 },
    uHeatDistortion: { type: 'float', value: 0.0 },
    uWaveAmplitude: { type: 'float', value: 0.015 },
    noiseTexture: { type: 'sampler2D', value: null },
    quantumPatternTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back',
  
  performance: {
    estimatedGpuCost: 0.4,
    qualityTier: 'high',
    textureCount: 3,
    uniformCount: 14,
    instructionEstimate: 280,
    targetPlatform: 'desktop'
  },
  
  features: {
    requiresBloom: true,
    requiresSSS: false,
    requiresSSR: true,
    supportsInstancing: true,
    supportsLOD: true
  }
};

/**
 * Prismatic Marble Material Configuration
 * 
 * @performance ~0.45ms GPU time (high-tier desktop)
 * @features Chromatic dispersion, spectral refraction, rainbow caustics
 */
export const PrismaticMarbleConfig: AdvancedMaterialConfig = {
  name: 'PrismaticMarble',
  vertexShader: ADVANCED_VERTEX_SHADER,
  fragmentShader: PRISMATIC_MARBLE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uDispersionStrength: { type: 'float', value: 0.8 },
    uIorRed: { type: 'float', value: 1.514 },
    uIorGreen: { type: 'float', value: 1.52 },
    uIorBlue: { type: 'float', value: 1.526 },
    uCausticIntensity: { type: 'float', value: 0.6 },
    uRainbowSpeed: { type: 'float', value: 2.0 },
    uSpectralShift: { type: 'float', value: 0.5 },
    uPrismaticSparkle: { type: 'float', value: 1.0 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    uHeatDistortion: { type: 'float', value: 0.0 },
    uWaveAmplitude: { type: 'float', value: 0.0 },
    dispersionTexture: { type: 'sampler2D', value: null },
    causticTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back',
  
  performance: {
    estimatedGpuCost: 0.45,
    qualityTier: 'ultra',
    textureCount: 3,
    uniformCount: 13,
    instructionEstimate: 320,
    targetPlatform: 'desktop'
  },
  
  features: {
    requiresBloom: true,
    requiresSSS: false,
    requiresSSR: true,
    supportsInstancing: true,
    supportsLOD: true
  }
};

/**
 * Volcanic Marble Material Configuration
 * 
 * @performance ~0.5ms GPU time (high-tier desktop)
 * @features Lava glow, heat distortion, emissive cracks, magma flow
 */
export const VolcanicMarbleConfig: AdvancedMaterialConfig = {
  name: 'VolcanicMarble',
  vertexShader: ADVANCED_VERTEX_SHADER,
  fragmentShader: VOLCANIC_MARBLE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uLavaFlowSpeed: { type: 'float', value: 0.8 },
    uHeatIntensity: { type: 'float', value: 1.5 },
    uCrackEmissive: { type: 'float', value: 0.9 },
    uMagmaViscosity: { type: 'float', value: 0.7 },
    uThermalPulse: { type: 'float', value: 0.6 },
    uAshCoverage: { type: 'float', value: 0.3 },
    uLavaColor: { type: 'vec3', value: [1.0, 0.35, 0.05] },
    uAshColor: { type: 'vec3', value: [0.15, 0.12, 0.1] },
    uGlowRadius: { type: 'float', value: 1.2 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    uHeatDistortion: { type: 'float', value: 0.08 },
    uWaveAmplitude: { type: 'float', value: 0.005 },
    lavaTexture: { type: 'sampler2D', value: null },
    crackTexture: { type: 'sampler2D', value: null },
    noiseTexture: { type: 'sampler2D', value: null },
    emberTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back',
  
  performance: {
    estimatedGpuCost: 0.5,
    qualityTier: 'high',
    textureCount: 5,
    uniformCount: 15,
    instructionEstimate: 350,
    targetPlatform: 'desktop'
  },
  
  features: {
    requiresBloom: true,
    requiresSSS: true,
    requiresSSR: false,
    supportsInstancing: true,
    supportsLOD: true
  }
};

// ============================================================================
// ENHANCED POST-PROCESSING
// ============================================================================

/**
 * Enhanced post-processing configuration interface
 */
export interface EnhancedPostProcessConfig {
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
    spectralShift?: boolean;
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
    lutTexture?: string;
  };
  
  // NEW: Depth of Field
  depthOfField: {
    enabled: boolean;
    focusDistance: number;      // Distance to focal plane
    focusRange: number;         // Range of sharp focus
    blurRadius: number;         // Maximum blur radius
    bokehShape: 'circular' | 'hexagonal' | 'octagonal';
    bokehIntensity: number;
  };
  
  // NEW: Vignette
  vignette: {
    enabled: boolean;
    intensity: number;
    smoothness: number;
    color: [number, number, number];
    rounded: boolean;
  };
  
  // NEW: Film Grain
  filmGrain: {
    enabled: boolean;
    intensity: number;
    speed: number;
    size: number;
    colorized: boolean;
  };
  
  // NEW: Ambient Occlusion
  ambientOcclusion: {
    enabled: boolean;
    intensity: number;
    radius: number;
    sampleCount: number;
  };
  
  // NEW: Heat Distortion
  heatDistortion?: {
    enabled: boolean;
    strength: number;
    speed: number;
  };
}

/**
 * Quantum Theme Post-Processing
 * Cinematic sci-fi look with subtle effects
 */
export const QuantumPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 1.5,
    threshold: 0.35,
    radius: 0.85,
    iterations: 5
  },
  motionBlur: {
    enabled: true,
    intensity: 0.35,
    samples: 10
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.012,
    spectralShift: true
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 56,
    stepSize: 0.05,
    thickness: 0.08
  },
  colorGrading: {
    enabled: true,
    contrast: 1.15,
    saturation: 1.1,
    tint: [0.92, 0.95, 1.0] // Cool blue tint
  },
  depthOfField: {
    enabled: true,
    focusDistance: 8.0,
    focusRange: 4.0,
    blurRadius: 8.0,
    bokehShape: 'hexagonal',
    bokehIntensity: 0.6
  },
  vignette: {
    enabled: true,
    intensity: 0.35,
    smoothness: 0.75,
    color: [0.05, 0.02, 0.1], // Deep purple
    rounded: true
  },
  filmGrain: {
    enabled: true,
    intensity: 0.08,
    speed: 24.0,
    size: 1.0,
    colorized: false
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.2,
    radius: 0.6,
    sampleCount: 16
  }
};

/**
 * Prismatic Theme Post-Processing
 * Vibrant rainbow aesthetic with colorful vignette
 */
export const PrismaticPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 1.2,
    threshold: 0.4,
    radius: 0.7,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.25,
    samples: 8
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.025, // Stronger for prismatic effect
    spectralShift: true
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 64,
    stepSize: 0.04,
    thickness: 0.06
  },
  colorGrading: {
    enabled: true,
    contrast: 1.08,
    saturation: 1.25, // Boosted saturation
    tint: [1.0, 1.0, 1.0]
  },
  depthOfField: {
    enabled: true,
    focusDistance: 10.0,
    focusRange: 5.0,
    blurRadius: 6.0,
    bokehShape: 'circular',
    bokehIntensity: 0.8 // Stronger bokeh for sparkle
  },
  vignette: {
    enabled: true,
    intensity: 0.25,
    smoothness: 0.6,
    color: [0.1, 0.05, 0.15], // Subtle purple
    rounded: false
  },
  filmGrain: {
    enabled: false,
    intensity: 0.0,
    speed: 0.0,
    size: 0.0,
    colorized: false
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.0,
    radius: 0.5,
    sampleCount: 12
  }
};

/**
 * Volcanic Theme Post-Processing
 * Warm, intense look with heat distortion
 */
export const VolcanicPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 3.0, // Strong bloom for lava glow
    threshold: 0.25,
    radius: 1.2,
    iterations: 6
  },
  motionBlur: {
    enabled: true,
    intensity: 0.4,
    samples: 12
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.018,
    spectralShift: false
  },
  screenSpaceReflections: {
    enabled: false // Disabled for performance with heat distortion
  },
  colorGrading: {
    enabled: true,
    contrast: 1.25,
    saturation: 1.3,
    tint: [1.15, 0.95, 0.85] // Warm orange tint
  },
  depthOfField: {
    enabled: true,
    focusDistance: 7.0,
    focusRange: 3.0,
    blurRadius: 10.0,
    bokehShape: 'circular',
    bokehIntensity: 0.7
  },
  vignette: {
    enabled: true,
    intensity: 0.4,
    smoothness: 0.8,
    color: [0.2, 0.05, 0.0], // Warm dark red
    rounded: true
  },
  filmGrain: {
    enabled: true,
    intensity: 0.12, // Heavier grain for volcanic texture
    speed: 18.0,
    size: 1.5,
    colorized: true // Warm colored grain
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.4,
    radius: 0.7,
    sampleCount: 20
  },
  heatDistortion: {
    enabled: true,
    strength: 0.05,
    speed: 2.5
  }
};

/**
 * Retro/Classic Film Post-Processing
 * Nostalgic film aesthetic
 */
export const RetroFilmPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.4,
    threshold: 0.7,
    radius: 0.4,
    iterations: 3
  },
  motionBlur: {
    enabled: true,
    intensity: 0.5,
    samples: 6
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.008,
    spectralShift: false
  },
  screenSpaceReflections: {
    enabled: false
  },
  colorGrading: {
    enabled: true,
    contrast: 1.3,
    saturation: 0.75, // Desaturated
    tint: [0.95, 0.9, 0.8] // Sepia-like
  },
  depthOfField: {
    enabled: true,
    focusDistance: 12.0,
    focusRange: 8.0,
    blurRadius: 12.0,
    bokehShape: 'circular',
    bokehIntensity: 0.5
  },
  vignette: {
    enabled: true,
    intensity: 0.6,
    smoothness: 0.9,
    color: [0.0, 0.0, 0.0],
    rounded: true
  },
  filmGrain: {
    enabled: true,
    intensity: 0.25, // Heavy grain
    speed: 12.0,
    size: 2.0,
    colorized: false
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.3,
    radius: 0.8,
    sampleCount: 12
  }
};

// ============================================================================
// ENVIRONMENT ENHANCEMENTS
// ============================================================================

/**
 * Screen-Space Subsurface Scattering (SSSS) Configuration
 * Approximates light scattering within translucent materials
 */
export interface SSSSConfig {
  enabled: boolean;
  
  // Sampling parameters
  sampleCount: number;
  sampleRadius: number;
  
  // Scattering profile (Gaussian weights)
  weights: [number, number, number, number, number, number];
  
  // Distance falloff
  distanceScale: number;
  
  // Color absorption
  absorptionColor: [number, number, number];
  absorptionCoefficients: {
    red: number;
    green: number;
    blue: number;
  };
  
  // Performance settings
  bilateralFilter: boolean;
  downsample: number; // 1 = full, 2 = half, 4 = quarter
}

/**
 * Default SSSS configuration for marble materials
 */
export const DefaultSSSSConfig: SSSSConfig = {
  enabled: true,
  sampleCount: 16,
  sampleRadius: 0.02,
  weights: [0.23, 0.21, 0.18, 0.15, 0.12, 0.11],
  distanceScale: 1.0,
  absorptionColor: [0.8, 0.6, 0.5],
  absorptionCoefficients: {
    red: 0.8,
    green: 1.2,
    blue: 1.6
  },
  bilateralFilter: true,
  downsample: 2
};

/**
 * Stone marble SSSS (warmer, stronger scattering)
 */
export const StoneSSSSConfig: SSSSConfig = {
  enabled: true,
  sampleCount: 20,
  sampleRadius: 0.025,
  weights: [0.25, 0.22, 0.18, 0.14, 0.11, 0.10],
  distanceScale: 1.2,
  absorptionColor: [0.9, 0.75, 0.6],
  absorptionCoefficients: {
    red: 0.7,
    green: 1.0,
    blue: 1.4
  },
  bilateralFilter: true,
  downsample: 2
};

/**
 * Lava SSSS (strong emission, minimal absorption)
 */
export const LavaSSSSConfig: SSSSConfig = {
  enabled: true,
  sampleCount: 12,
  sampleRadius: 0.03,
  weights: [0.3, 0.25, 0.2, 0.12, 0.08, 0.05],
  distanceScale: 2.0,
  absorptionColor: [1.0, 0.4, 0.1],
  absorptionCoefficients: {
    red: 0.5,
    green: 1.5,
    blue: 2.0
  },
  bilateralFilter: false,
  downsample: 2
};

/**
 * Reflection Probe Blending Configuration
 * Smooth transitions between probe zones
 */
export interface ProbeBlendingConfig {
  enabled: boolean;
  
  // Blend distance parameters
  blendDistance: number;
  blendOverlap: number;
  
  // Blend curve (0 = linear, 1 = smooth, 2 = smoother)
  blendCurve: number;
  
  // Priority-based blending
  usePriorityWeights: boolean;
  
  // Update strategy
  updateStrategy: 'distance' | 'priority' | 'hybrid';
  
  // Performance
  maxActiveProbes: number;
  cullDistance: number;
}

/**
 * Default probe blending configuration
 */
export const DefaultProbeBlendingConfig: ProbeBlendingConfig = {
  enabled: true,
  blendDistance: 5.0,
  blendOverlap: 2.0,
  blendCurve: 1,
  usePriorityWeights: true,
  updateStrategy: 'hybrid',
  maxActiveProbes: 4,
  cullDistance: 50.0
};

/**
 * Zone transition configuration for track segments
 */
export interface ZoneTransitionConfig {
  zoneA: string;
  zoneB: string;
  transitionLength: number;
  
  // Blend factors
  skyboxBlend: boolean;
  lightingBlend: boolean;
  fogBlend: boolean;
  reflectionBlend: boolean;
  
  // Transition curve
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'custom';
  customCurve?: number[]; // 0-1 values for custom curve
}

/**
 * Reflection probe with zone awareness
 */
export interface ZoneAwareReflectionProbe {
  id: string;
  resolution: number;
  updateMode: 'realtime' | 'onAwake' | 'scheduled';
  updateInterval: number;
  position: [number, number, number];
  near: number;
  far: number;
  cullingMask: string[];
  intensity: number;
  priority: number;
  
  // Zone configuration
  zoneId: string;
  zoneBounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  
  // Blending
  blendDistance: number;
  influenceWeight: number;
  
  // Parallax correction
  parallaxCorrection: boolean;
  parallaxBoxMin: [number, number, number];
  parallaxBoxMax: [number, number, number];
}

// ============================================================================
// COMPLETE RENDERING PACKAGES
// ============================================================================

/**
 * Complete rendering package interface
 */
export interface AdvancedMarbleRenderingPackage {
  name: string;
  materialConfig: AdvancedMaterialConfig;
  particleEffects: AdvancedParticleEffect[];
  postProcessConfig: EnhancedPostProcessConfig;
  ssssConfig?: SSSSConfig;
  probeBlending?: ProbeBlendingConfig;
}

/**
 * Quantum Marble Complete Package
 */
export const QuantumMarblePackage: AdvancedMarbleRenderingPackage = {
  name: 'QuantumMarble',
  materialConfig: QuantumMarbleConfig,
  particleEffects: [QuantumEntanglementParticles],
  postProcessConfig: QuantumPostProcess,
  ssssConfig: {
    ...DefaultSSSSConfig,
    absorptionColor: [0.7, 0.4, 0.9],
    absorptionCoefficients: { red: 0.6, green: 1.0, blue: 1.2 }
  },
  probeBlending: DefaultProbeBlendingConfig
};

/**
 * Prismatic Marble Complete Package
 */
export const PrismaticMarblePackage: AdvancedMarbleRenderingPackage = {
  name: 'PrismaticMarble',
  materialConfig: PrismaticMarbleConfig,
  particleEffects: [PrismaticSparkles],
  postProcessConfig: PrismaticPostProcess,
  probeBlending: DefaultProbeBlendingConfig
};

/**
 * Volcanic Marble Complete Package
 */
export const VolcanicMarblePackage: AdvancedMarbleRenderingPackage = {
  name: 'VolcanicMarble',
  materialConfig: VolcanicMarbleConfig,
  particleEffects: [VolcanicEmberTrails],
  postProcessConfig: VolcanicPostProcess,
  ssssConfig: LavaSSSSConfig,
  probeBlending: DefaultProbeBlendingConfig
};

/**
 * All advanced marble packages
 */
export const AllAdvancedMarblePackages: AdvancedMarbleRenderingPackage[] = [
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage
];

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Shader source exports for external use
 */
export const AdvancedShaderSource = {
  vertex: ADVANCED_VERTEX_SHADER,
  quantumFragment: QUANTUM_MARBLE_FRAGMENT_SHADER,
  prismaticFragment: PRISMATIC_MARBLE_FRAGMENT_SHADER,
  volcanicFragment: VOLCANIC_MARBLE_FRAGMENT_SHADER
};

/**
 * Performance profile recommendations
 */
export const PerformanceProfiles = {
  mobile: {
    maxParticles: 100,
    bloomIterations: 3,
    sssSamples: 8,
    dofQuality: 'low',
    aoSamples: 8,
    useHeatDistortion: false
  },
  desktop: {
    maxParticles: 300,
    bloomIterations: 5,
    sssSamples: 16,
    dofQuality: 'high',
    aoSamples: 16,
    useHeatDistortion: true
  },
  ultra: {
    maxParticles: 500,
    bloomIterations: 7,
    sssSamples: 24,
    dofQuality: 'ultra',
    aoSamples: 32,
    useHeatDistortion: true
  }
};

/**
 * Get recommended performance profile for target platform
 */
export function getPerformanceProfile(platform: 'mobile' | 'desktop' | 'ultra'): typeof PerformanceProfiles.desktop {
  return PerformanceProfiles[platform] || PerformanceProfiles.desktop;
}

/**
 * Estimate total GPU cost for a rendering package
 */
export function estimateGpuCost(pkg: AdvancedMarbleRenderingPackage): number {
  let total = pkg.materialConfig.performance.estimatedGpuCost;
  
  // Add particle cost
  for (const effect of pkg.particleEffects) {
    total += (effect.maxParticles / 100) * 0.1;
  }
  
  // Add post-process cost
  if (pkg.postProcessConfig.bloom.enabled) {
    total += pkg.postProcessConfig.bloom.iterations * 0.05;
  }
  if (pkg.postProcessConfig.depthOfField.enabled) {
    total += 0.2;
  }
  if (pkg.postProcessConfig.ambientOcclusion.enabled) {
    total += pkg.postProcessConfig.ambientOcclusion.sampleCount * 0.01;
  }
  if (pkg.ssssConfig?.enabled) {
    total += pkg.ssssConfig.sampleCount * 0.008;
  }
  
  return total;
}

// Default export
export default {
  // Shaders
  ADVANCED_VERTEX_SHADER,
  QUANTUM_MARBLE_FRAGMENT_SHADER,
  PRISMATIC_MARBLE_FRAGMENT_SHADER,
  VOLCANIC_MARBLE_FRAGMENT_SHADER,
  
  // Particle effects
  QuantumEntanglementParticles,
  PrismaticSparkles,
  VolcanicEmberTrails,
  
  // Material configs
  QuantumMarbleConfig,
  PrismaticMarbleConfig,
  VolcanicMarbleConfig,
  
  // Post-process configs
  QuantumPostProcess,
  PrismaticPostProcess,
  VolcanicPostProcess,
  RetroFilmPostProcess,
  
  // SSSS configs
  DefaultSSSSConfig,
  StoneSSSSConfig,
  LavaSSSSConfig,
  
  // Complete packages
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage,
  AllAdvancedMarblePackages,
  
  // Utilities
  AdvancedShaderSource,
  PerformanceProfiles,
  getPerformanceProfile,
  estimateGpuCost
};
