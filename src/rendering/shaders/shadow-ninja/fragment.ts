/**
 * Shadow Ninja Fragment Shader
 * Features: Void absorption (light-draining), smoke wisps, shadow tendrils,
 *           purple rim lighting, ethereal distortion
 */

export const SHADOW_NINJA_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D voidNoiseTexture;
uniform sampler2D shadowTendrilTexture;
uniform sampler2D smokeWispTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uVoidAbsorption;
uniform float uSmokeIntensity;
uniform float uRimLightPower;
uniform float uDistortionStrength;
uniform float uShadowSpeed;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;
out vec4 bloomColor;

// Void noise - multi-layered darkness
float voidNoise(vec3 pos, float time) {
    float noise = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    
    for (int i = 0; i < 6; i++) {
        vec3 p = pos * frequency + time * uShadowSpeed * float(i + 1);
        noise += sin(p.x) * cos(p.y) * sin(p.z) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.5;
    }
    
    return noise * 0.5 + 0.5;
}

// Shadow tendril pattern
float shadowTendrils(vec2 uv, vec3 worldPos, float time) {
    float tendrils = 0.0;
    
    // Primary tendrils
    vec2 p1 = uv * 6.0 + time * 0.3;
    float t1 = sin(p1.x + sin(p1.y * 2.0 + time * 0.5)) * 0.5 + 0.5;
    tendrils += smoothstep(0.6, 0.65, t1) * 0.7;
    
    // Secondary tendrils
    vec2 p2 = uv * 10.0 - time * 0.2;
    float t2 = sin(p2.y + cos(p2.x * 1.5)) * 0.5 + 0.5;
    tendrils += smoothstep(0.7, 0.75, t2) * 0.4;
    
    // World-space variation
    float worldVar = sin(worldPos.x * 3.0 + worldPos.z * 2.0) * 0.3 + 0.7;
    
    return tendrils * worldVar;
}

// Smoke wisp overlay
vec3 smokeWisps(vec2 uv, vec3 worldPos, float time) {
    vec3 smoke = vec3(0.0);
    
    // Layer 1: Slow drifting smoke
    vec2 s1 = uv * 4.0 + vec2(time * 0.1, time * 0.15);
    float n1 = sin(s1.x * 3.0) * cos(s1.y * 2.0);
    n1 += sin(s1.x * 7.0 - time * 0.3) * 0.5;
    smoke += vec3(0.1, 0.05, 0.15) * (n1 * 0.5 + 0.5) * 0.4;
    
    // Layer 2: Faster ethereal wisps
    vec2 s2 = uv * 8.0 + vec2(-time * 0.2, time * 0.1);
    float n2 = sin(s2.x * 5.0 + s2.y * 3.0) * sin(s2.y * 4.0);
    smoke += vec3(0.15, 0.08, 0.2) * (n2 * 0.5 + 0.5) * 0.3;
    
    return smoke * uSmokeIntensity;
}

// Void absorption - darkens nearby areas
float calculateVoidAbsorption(vec3 worldPos, vec3 viewDir, vec3 normal) {
    float centerDarkness = voidNoise(worldPos * 2.0, uTime * 0.5);
    
    // Edge falloff for absorption effect
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    
    // Pulsing void core
    float pulse = sin(uTime * 1.5) * 0.2 + 0.8;
    
    return centerDarkness * fresnel * pulse * uVoidAbsorption;
}

// Purple rim light calculation
vec3 calculateRimLight(vec3 viewDir, vec3 normal, float power) {
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), power);
    
    // Color variation based on angle
    vec3 rimColor1 = vec3(0.6, 0.2, 0.9);  // Bright purple
    vec3 rimColor2 = vec3(0.3, 0.1, 0.5);  // Darker purple
    
    float angleVar = sin(atan(normal.y, normal.x) * 3.0 + uTime) * 0.5 + 0.5;
    vec3 rimColor = mix(rimColor1, rimColor2, angleVar);
    
    return rimColor * fresnel * 3.0;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Base void color - deep purple-black
    vec3 baseColor = vec3(0.01, 0.01, 0.015);
    
    // Void noise texture
    float voidTex = voidNoise(vWorldPosition * 8.0, uTime * 0.3);
    baseColor *= (0.7 + voidTex * 0.6);
    
    // Shadow tendrils
    float tendrils = shadowTendrils(vUv, vWorldPosition, uTime);
    vec3 tendrilColor = vec3(0.02, 0.01, 0.03) * tendrils;
    
    // Smoke wisps
    vec3 smoke = smokeWisps(vUv, vWorldPosition, uTime);
    
    // Environment reflection (very subtle for void)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    reflection *= 0.15;  // Very muted reflection
    
    // Void absorption effect
    float absorption = calculateVoidAbsorption(vWorldPosition, viewDir, normal);
    vec3 absorptionColor = vec3(0.0) * absorption;
    
    // Purple rim light
    vec3 rimLight = calculateRimLight(viewDir, normal, uRimLightPower);
    
    // Emissive smoke glow
    float emissiveSmoke = voidNoise(vWorldPosition * 4.0 + uTime * 0.5, uTime * 0.2);
    vec3 emissiveColor = vec3(0.4, 0.1, 0.6) * emissiveSmoke * 0.5;
    
    // Combine all layers
    vec3 finalColor = baseColor;
    finalColor += tendrilColor;
    finalColor += smoke;
    finalColor += reflection;
    finalColor += absorptionColor;
    finalColor += rimLight;
    finalColor += emissiveColor;
    
    // Edge darkening (void characteristic)
    float edgeDarken = pow(abs(dot(viewDir, normal)), 0.5);
    finalColor *= mix(0.3, 1.0, edgeDarken);
    
    // Subsurface scattering approximation
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float wrap = 0.6;
    float sss = max(dot(normal, lightDir) + wrap, 0.0) / ((1.0 + wrap) * (1.0 + wrap));
    finalColor += vec3(0.05, 0.02, 0.08) * sss * 0.3;
    
    // Bloom calculation (rim light and emissive smoke)
    vec3 bloom = rimLight * 0.8 + emissiveColor * 0.5;
    float bloomLuma = dot(bloom, vec3(0.299, 0.587, 0.114));
    bloom = mix(vec3(0.0), bloom, smoothstep(0.3, 0.8, bloomLuma));
    
    fragColor = vec4(finalColor, 1.0);
    bloomColor = vec4(bloom, 1.0);
}
`;
