/**
 * Enhanced fragment shader with parallax occlusion mapping
 * Provides depth illusion without tessellation
 */
export const PARALLAX_MAPPING_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D albedoTexture;
uniform sampler2D normalTexture;
uniform sampler2D heightTexture;
uniform sampler2D roughnessTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uParallaxScale;
uniform float uParallaxSteps;
uniform float uSpecularIntensity;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;

// Parallax Occlusion Mapping
vec2 parallaxOcclusionMapping(vec2 uv, vec3 viewDirTangent) {
    float layerDepth = 1.0 / uParallaxSteps;
    float currentLayerDepth = 0.0;
    
    vec2 deltaUv = viewDirTangent.xy * uParallaxScale / uParallaxSteps;
    vec2 currentUv = uv;
    
    float currentDepthMapValue = texture(heightTexture, currentUv).r;
    
    // Ray march through layers
    for (int i = 0; i < 32; i++) {
        if (float(i) >= uParallaxSteps) break;
        if (currentLayerDepth >= currentDepthMapValue) break;
        
        currentUv -= deltaUv;
        currentDepthMapValue = texture(heightTexture, currentUv).r;
        currentLayerDepth += layerDepth;
    }
    
    // Interpolate between layers for smooth result
    vec2 prevUv = currentUv + deltaUv;
    float afterDepth = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(heightTexture, prevUv).r - currentLayerDepth + layerDepth;
    
    float weight = afterDepth / (afterDepth - beforeDepth);
    return prevUv * weight + currentUv * (1.0 - weight);
}

// Enhanced normal mapping with parallax
mat3 getTBNMatrix() {
    vec3 N = normalize(vNormal);
    vec3 T = normalize(vTangent);
    vec3 B = normalize(vBitangent);
    return mat3(T, B, N);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Get tangent-space view direction for parallax
    mat3 TBN = getTBNMatrix();
    vec3 viewDirTangent = normalize(inverse(TBN) * viewDir);
    
    // Apply parallax occlusion mapping
    vec2 displacedUv = parallaxOcclusionMapping(vUv, viewDirTangent);
    
    // Discard if UV is out of bounds (parallax went too far)
    if (displacedUv.x > 1.0 || displacedUv.y > 1.0 || 
        displacedUv.x < 0.0 || displacedUv.y < 0.0) {
        displacedUv = vUv;
    }
    
    // Sample normal with displacement
    vec3 tangentNormal = texture(normalTexture, displacedUv).rgb * 2.0 - 1.0;
    vec3 worldNormal = normalize(TBN * tangentNormal);
    
    // Sample material properties
    vec4 albedo = texture(albedoTexture, displacedUv);
    float roughness = texture(roughnessTexture, displacedUv).r;
    float height = texture(heightTexture, displacedUv).r;
    
    // Environment reflection
    vec3 reflectDir = reflect(-viewDir, worldNormal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    
    // Fresnel
    float fresnel = pow(1.0 - abs(dot(viewDir, worldNormal)), 5.0);
    fresnel = mix(0.04, 1.0, fresnel);
    
    // Simple lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(worldNormal, lightDir), 0.0);
    
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(worldNormal, halfDir), 0.0), (1.0 - roughness) * 256.0);
    
    // Combine
    vec3 ambient = albedo.rgb * 0.1;
    vec3 diffuse = albedo.rgb * diff * 0.6;
    vec3 specular = vec3(spec) * uSpecularIntensity * fresnel;
    vec3 reflectColor = reflection * fresnel * (1.0 - roughness);
    
    vec3 finalColor = ambient + diffuse + specular + reflectColor;
    
    // Height-based occlusion
    finalColor *= (0.5 + height * 0.5);
    
    fragColor = vec4(finalColor, albedo.a);
}
`;
