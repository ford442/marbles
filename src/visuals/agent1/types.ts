/**
 * Agent 1: Beauty Layer - Type Definitions
 * Marble Visual Overhaul Agent Swarm
 * 
 * Performance Budget: < 0.5ms per marble
 * @module agent1/types
 */

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
