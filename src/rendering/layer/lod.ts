/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * LOD Configuration
 */

import { LODConfig } from './types';

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
