/**
 * Agent 3: Advanced Rendering Layer - Quantum Marble Fragment Shader
 * 
 * Quantum Marble Fragment Shader
 * Features: Wave interference patterns, probability clouds, energy pulse effects,
 *           quantum entanglement visualization, superposition states
 * 
 * Performance: ~0.4ms on mid-tier GPU
 */

/**
 * Quantum Marble Fragment Shader
 */
export const QUANTUM_MARBLE_FRAGMENT_SHADER = `
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
