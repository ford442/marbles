/**
 * EXTREME LEVEL MARBLE SHADERS - Multi-Agent Swarm Visual Overhaul
 * Shadow Ninja & Volcanic Magma - Modular Shader Package
 * 
 * Import this module in marble_rendering_layer.ts
 */

// ============================================================================
// Shader Imports
// ============================================================================

export {
  SHADOW_NINJA_FRAGMENT_SHADER,
  SHADOW_NINJA_VERTEX_SHADER
} from './shadow-ninja';

export {
  VOLCANIC_MAGMA_FRAGMENT_SHADER,
  VOLCANIC_MAGMA_VERTEX_SHADER
} from './volcanic-magma';

export {
  // Shader source
  GALACTIC_CORE_FRAGMENT_SHADER,
  
  // Material configs (without shader strings - use createMaterialConfig helpers)
  ShadowNinjaMaterialConfig as ShadowNinjaMaterialConfigBase,
  VolcanicMagmaMaterialConfig as VolcanicMagmaMaterialConfigBase,
  GalacticCoreMaterialConfig as GalacticCoreMaterialConfigBase,
  
  // Particle effects
  ShadowNinjaParticleEffects,
  VolcanicMagmaParticleEffects,
  GalacticCoreParticleEffects,
  
  // Post-process configs
  ShadowNinjaPostProcess,
  VolcanicMagmaPostProcess,
  GalacticCorePostProcess
} from './shared';

// Import shader strings for creating full material configs
import { SHADOW_NINJA_FRAGMENT_SHADER } from './shadow-ninja';
import { VOLCANIC_MAGMA_FRAGMENT_SHADER } from './volcanic-magma';
import {
  ShadowNinjaMaterialConfigBase,
  VolcanicMagmaMaterialConfigBase,
  GalacticCoreMaterialConfigBase,
  ShadowNinjaParticleEffects,
  VolcanicMagmaParticleEffects,
  GalacticCoreParticleEffects,
  ShadowNinjaPostProcess,
  VolcanicMagmaPostProcess,
  GalacticCorePostProcess,
  GALACTIC_CORE_FRAGMENT_SHADER
} from './shared';

// ============================================================================
// Material Configurations (with actual shader strings)
// ============================================================================

export const ShadowNinjaMaterialConfig = {
  ...ShadowNinjaMaterialConfigBase,
  fragmentShader: SHADOW_NINJA_FRAGMENT_SHADER
};

export const VolcanicMagmaMaterialConfig = {
  ...VolcanicMagmaMaterialConfigBase,
  fragmentShader: VOLCANIC_MAGMA_FRAGMENT_SHADER
};

export const GalacticCoreMaterialConfig = {
  ...GalacticCoreMaterialConfigBase,
  fragmentShader: GALACTIC_CORE_FRAGMENT_SHADER
};

// ============================================================================
// Complete Rendering Packages
// ============================================================================

export const ShadowNinjaExtremeMarble = {
  name: 'ShadowNinjaExtreme',
  materialConfig: ShadowNinjaMaterialConfig,
  particleEffects: ShadowNinjaParticleEffects,
  postProcessConfig: ShadowNinjaPostProcess,
  lodConfig: {
    levels: [
      {
        distance: 0,
        mesh: 'marble_shadow_ninja_lod0.glb',
        material: 'shadow_ninja_full',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 15,
        mesh: 'marble_shadow_ninja_lod1.glb',
        material: 'shadow_ninja_medium',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 40,
        mesh: 'marble_shadow_ninja_lod2.glb',
        material: 'shadow_ninja_low',
        shadowCasting: false,
        receiveShadows: true
      }
    ],
    impostor: {
      enabled: true,
      distance: 80,
      textureResolution: 256,
      updateRate: 8,
      billboardMode: 'spherical'
    },
    instancing: {
      enabled: true,
      maxInstances: 100,
      frustumCulling: true,
      occlusionCulling: true,
      dynamicBatching: true
    }
  }
};

export const VolcanicMagmaExtremeMarble = {
  name: 'VolcanicMagmaExtreme',
  materialConfig: VolcanicMagmaMaterialConfig,
  particleEffects: VolcanicMagmaParticleEffects,
  postProcessConfig: VolcanicMagmaPostProcess,
  lodConfig: {
    levels: [
      {
        distance: 0,
        mesh: 'marble_volcanic_magma_lod0.glb',
        material: 'volcanic_magma_full',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 12,
        mesh: 'marble_volcanic_magma_lod1.glb',
        material: 'volcanic_magma_medium',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 35,
        mesh: 'marble_volcanic_magma_lod2.glb',
        material: 'volcanic_magma_low',
        shadowCasting: false,
        receiveShadows: true
      }
    ],
    impostor: {
      enabled: true,
      distance: 70,
      textureResolution: 256,
      updateRate: 10,
      billboardMode: 'spherical'
    },
    instancing: {
      enabled: true,
      maxInstances: 100,
      frustumCulling: true,
      occlusionCulling: true,
      dynamicBatching: true
    }
  }
};

export const GalacticCoreExtremeMarble = {
  name: 'GalacticCoreExtreme',
  materialConfig: GalacticCoreMaterialConfig,
  particleEffects: GalacticCoreParticleEffects,
  postProcessConfig: GalacticCorePostProcess,
  lodConfig: {
    levels: [
      {
        distance: 0,
        mesh: 'marble_galactic_core_lod0.glb',
        material: 'galactic_core_full',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 20,
        mesh: 'marble_galactic_core_lod1.glb',
        material: 'galactic_core_medium',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 50,
        mesh: 'marble_galactic_core_lod2.glb',
        material: 'galactic_core_low',
        shadowCasting: false,
        receiveShadows: true
      }
    ],
    impostor: {
      enabled: true,
      distance: 90,
      textureResolution: 512,
      updateRate: 15,
      billboardMode: 'spherical'
    },
    instancing: {
      enabled: true,
      maxInstances: 100,
      frustumCulling: true,
      occlusionCulling: true,
      dynamicBatching: true
    }
  }
};

// ============================================================================
// Export Collections
// ============================================================================

// Export all shader source for external use
export const ExtremeShaderSource = {
  shadowNinjaFragment: SHADOW_NINJA_FRAGMENT_SHADER,
  volcanicMagmaFragment: VOLCANIC_MAGMA_FRAGMENT_SHADER,
  galacticCoreFragment: GALACTIC_CORE_FRAGMENT_SHADER
};

// Integration helper - add to AllMarbleRenderingPackages
export const AllExtremeMarbles = [
  ShadowNinjaExtremeMarble,
  VolcanicMagmaExtremeMarble,
  GalacticCoreExtremeMarble
];

// Default export for convenience
export default {
  shaders: ExtremeShaderSource,
  materials: {
    shadowNinja: ShadowNinjaMaterialConfig,
    volcanicMagma: VolcanicMagmaMaterialConfig,
    galacticCore: GalacticCoreMaterialConfig
  },
  marbles: AllExtremeMarbles
};
