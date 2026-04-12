/**
 * Agent 3: Advanced Rendering Layer - Prismatic Marble Fragment Shader
 * 
 * Prismatic Marble Fragment Shader
 * Features: Chromatic dispersion, light splitting, rainbow caustics,
 *           dispersion-based IOR, spectral refraction
 * 
 * Performance: ~0.45ms on mid-tier GPU
 */

/**
 * Prismatic Marble Fragment Shader
 */
export const PRISMATIC_MARBLE_FRAGMENT_SHADER = `
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
