/**
 * Weathering overlay shader
 * Applies wear, dirt, and rust based on weathering map
 */
export const WEATHERING_OVERLAY_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D albedoTexture;
uniform sampler2D normalTexture;
uniform sampler2D weatheringMap;
uniform sampler2D rustTexture;
uniform samplerCube envMap;
uniform float uWearIntensity;
uniform float uDirtIntensity;
uniform float uRustIntensity;
uniform float uTime;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Sample base textures
    vec3 albedo = texture(albedoTexture, vUv).rgb;
    vec3 tangentNormal = texture(normalTexture, vUv).rgb * 2.0 - 1.0;
    
    // Sample weathering map
    vec4 weathering = texture(weatheringMap, vUv);
    float wear = weathering.r * uWearIntensity;
    float dirt = weathering.g * uDirtIntensity;
    float rust = weathering.b * uRustIntensity;
    float occlusion = weathering.a;
    
    // Sample rust texture
    vec3 rustColor = texture(rustTexture, vUv * 3.0).rgb;
    rustColor = vec3(0.6, 0.3, 0.1) * rustColor.r;
    
    // Dirt color (dark brown)
    vec3 dirtColor = vec3(0.15, 0.12, 0.08);
    
    // Apply wear (lightens and roughens)
    vec3 wornAlbedo = albedo * (1.0 + wear * 0.3);
    
    // Apply dirt (darkens and tints brown)
    wornAlbedo = mix(wornAlbedo, dirtColor, dirt * 0.7);
    
    // Apply rust (orange-brown overlay)
    wornAlbedo = mix(wornAlbedo, rustColor, rust * 0.8);
    
    // Ambient occlusion from weathering
    wornAlbedo *= (0.3 + occlusion * 0.7);
    
    // Simple lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Roughness increases with wear and rust
    float roughness = 0.3 + wear * 0.4 + rust * 0.3;
    
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), (1.0 - roughness) * 128.0);
    
    // Environment reflection (reduced by rust and dirt)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    float reflectivity = (1.0 - roughness) * (1.0 - rust * 0.5) * (1.0 - dirt * 0.3);
    
    // Combine
    vec3 ambient = wornAlbedo * 0.15;
    vec3 diffuse = wornAlbedo * diff * 0.6;
    vec3 specular = vec3(spec) * (1.0 - wear * 0.5) * (1.0 - rust * 0.8);
    vec3 reflectColor = reflection * reflectivity;
    
    vec3 finalColor = ambient + diffuse + specular + reflectColor;
    
    // Subtle wetness effect for dirt
    float wetness = dirt * 0.3;
    finalColor = mix(finalColor, finalColor * 0.8, wetness);
    
    fragColor = vec4(finalColor, 1.0);
}
`;
