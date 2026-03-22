/**
 * Visuals Module Index
 * Marble Visual Overhaul v5.1.0 - Agent Swarm Integration
 * 
 * This is the main entry point for all visual enhancements.
 * Import from this module to access all swarm features.
 */

// ============================================================================
// BASE MODULES (Original)
// ============================================================================

export {
  MarbleVisual,
  MarbleTheme,
  MarbleVisualConfig,
  PhysicsState,
  LODLevel,
  createMarbleVisual,
  getThemeForMarble,
  validatePerformance,
  checkWebGL2Support
} from './MarbleVisual.js';

// ============================================================================
// AGENT 1: BEAUTY LAYER
// ============================================================================

export {
  RefinedMarbleMaterialConfig,
  RefinedGlassMaterialConfig,
  RefinedObsidianMaterialConfig,
  RefinedNeonMaterialConfig,
  RefinedStoneMaterialConfig,
  QuantumCrystalMaterialConfig,
  AllRefinedMarblePackages,
  EnhancedColorPalettes,
  QuantumCrystalPalette,
  PerformanceMetrics,
  QualityTierMapping,
  RefinedShaderSource
} from './agent1_beauty_refinement.js';

// ============================================================================
// AGENT 2: COMPLEXITY LAYER
// ============================================================================

export {
  // Noise functions
  generateFBMNoise,
  generateSimplexNoise,
  generateWorleyNoise,
  generateRidgedFBM,
  generateTurbulentFBM,
  generateFBMNoise2D,
  generateSimplexNoise2D,
  generateWorleyNoise2D,
  
  // Texture generators
  createMarbleVeinTexture,
  createCircuitPattern,
  createMetalGrainTexture,
  createWeatheringMap,
  
  // Vertex deformation
  generateImpactDeformation,
  generateRollFlattening,
  generateBounceWobble,
  applyCompositeDeformation,
  
  // Shader code
  PARALLAX_MAPPING_FRAGMENT_SHADER,
  VELOCITY_CIRCUIT_FRAGMENT_SHADER,
  WEATHERING_OVERLAY_FRAGMENT_SHADER,
  DEFORMATION_VERTEX_SHADER,
  EnhancedShaders,
  
  // Utilities
  SeededRandom,
  imageDataToTexture,
  
  // Presets
  MarbleTexturePresets,
  CircuitPatternPresets,
  MetalGrainPresets,
  WeatheringPresets,
  AllPresets
} from './agent2_complexity_refinement.js';

// ============================================================================
// AGENT 3: ADVANCED RENDERING
// ============================================================================

export {
  // Shader code
  QUANTUM_MARBLE_FRAGMENT_SHADER,
  PRISMATIC_MARBLE_FRAGMENT_SHADER,
  VOLCANIC_MARBLE_FRAGMENT_SHADER,
  
  // Material configs
  QuantumMarbleConfig,
  PrismaticMarbleConfig,
  VolcanicMarbleConfig,
  
  // Particle effects
  QuantumEntanglementParticles,
  PrismaticSparkles,
  VolcanicEmberTrails,
  
  // Post-processing
  QuantumPostProcess,
  PrismaticPostProcess,
  VolcanicPostProcess,
  DepthOfFieldConfigs,
  VignetteConfigs,
  FilmGrainConfigs,
  
  // Environment
  ScreenSpaceSubsurfaceScatteringConfigs,
  ReflectionProbeBlendConfigs,
  
  // Packages
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage,
  AllAdvancedMarblePackages,
  
  // Utilities
  estimateGpuCost
} from './agent3_advanced_rendering.js';

// ============================================================================
// AGENT 4: TRACK MATERIALS
// ============================================================================

export {
  // Enums
  TrackSurfaceType,
  SurfaceFinish,
  TrafficIntensity,
  MaterialQuality,
  
  // Interfaces
  TrackMaterialProperties,
  TrackWearState,
  TrackZoneVisualMetadata,
  ReflectionProbeHint,
  
  // Materials
  BASE_TRACK_MATERIALS,
  PREDEFINED_ZONE_CONFIGS,
  DEFAULT_WEAR_CONFIG,
  
  // Functions
  updateWearState,
  applyWearToMaterial,
  createZoneReflectionProbe,
  blendReflectionProbes,
  getTrackMaterialForZone,
  createMainJSCompatibleMaterial,
  selectOptimalMaterialQuality,
  
  // Classes
  TrackMaterialBatchUpdater
} from './agent4_track_materials.js';

// ============================================================================
// SWARM INTEGRATION
// ============================================================================

export {
  // Extended types
  ExtendedMarbleTheme,
  SwarmMaterialConfig,
  DefaultSwarmConfig,
  TrackZoneConfig,
  
  // Main class
  SwarmMarbleVisual,
  
  // Factories
  createSwarmMarbleVisual,
  getExtendedThemeForMarble,
  createSwarmTrackMaterial,
  
  // Managers
  SwarmTrackManager,
  
  // Validation
  validateSwarmPerformance,
  SwarmPerformanceMetrics
} from './MarbleVisualSwarmIntegration.js';

// ============================================================================
// MASTER INTEGRATION (All-in-one import)
// ============================================================================

export {
  AllMarbleTypes,
  UnifiedMarbleRegistry,
  getMarblePackage,
  getPackagesByTier,
  calculateMarbleDeformation,
  applyProceduralWeathering,
  setupUnifiedEnvironment,
  UnifiedEnvironmentConfig,
  AdaptiveQualityManager,
  SwarmIntegration,
  SWARM_VERSION,
  SWARM_SEED,
  AGENT_COUNT,
  SwarmManifest
} from './SWARM_INTEGRATION.js';

// ============================================================================
// VERSION INFO
// ============================================================================

export const VISUALS_VERSION = '5.1.0';
export const VISUALS_SEED = 1337;

export const VisualsManifest = {
  version: VISUALS_VERSION,
  seed: VISUALS_SEED,
  modules: {
    base: 'MarbleVisual.ts',
    agent1: 'agent1_beauty_refinement.ts',
    agent2: 'agent2_complexity_refinement.ts',
    agent3: 'agent3_advanced_rendering.ts',
    agent4: 'agent4_track_materials.ts',
    integration: 'MarbleVisualSwarmIntegration.ts',
    swarm: 'SWARM_INTEGRATION.ts'
  },
  marbleThemes: [
    'classic_glass',
    'obsidian_metal',
    'neon_glow',
    'stone_vein',
    'quantum_crystal',
    'quantum_marble',
    'prismatic_marble',
    'volcanic_marble'
  ],
  trackSurfaces: [
    'obsidian',
    'ice',
    'rubber',
    'sand',
    'volcanic_rock',
    'crystal',
    'wood',
    'metal',
    'concrete'
  ]
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export { default } from './SWARM_INTEGRATION.js';
