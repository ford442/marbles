/**
 * MarbleVisual Swarm Integration Module
 * Bridges existing MarbleVisual.ts with Agent Swarm refinements
 * 
 * This module extends the existing MarbleVisual class with swarm features
 * without modifying the original file.
 */

import * as Filament from 'filament';
import { vec3, vec4, quat, mat4 } from 'gl-matrix';
import { 
  MarbleVisual, 
  MarbleTheme, 
  MarbleVisualConfig, 
  PhysicsState,
  LODLevel,
  createMarbleVisual as baseCreateMarbleVisual,
  getThemeForMarble as baseGetThemeForMarble
} from './MarbleVisual.js';

// Import Agent 1: Beauty Layer refinements
import {
  QuantumCrystalMaterialConfig,
  EnhancedColorPalettes,
  PerformanceMetrics,
  QualityTierMapping
} from './agent1_beauty_refinement.js';

// Import Agent 2: Complexity Layer
import {
  generateFBMNoise,
  generateSimplexNoise,
  generateWorleyNoise,
  createMarbleVeinTexture,
  createCircuitPattern,
  generateImpactDeformation,
  generateRollFlattening,
  applyCompositeDeformation,
  SeededRandom
} from './agent2_complexity_refinement.js';

// Import Agent 3: Advanced Rendering
import {
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage,
  estimateGpuCost,
  DepthOfFieldConfigs
} from './agent3_advanced_rendering.js';

// Import Agent 4: Track Materials
import {
  TrackSurfaceType,
  getTrackMaterialForZone,
  TrackMaterialBatchUpdater,
  applyWearToMaterial
} from './agent4_track_materials.js';

// ============================================================================
// EXTENDED MARBLE THEME ENUM (with swarm additions)
// ============================================================================

export enum ExtendedMarbleTheme {
  // Original themes
  CLASSIC_GLASS = 'classic_glass',
  OBSIDIAN_METAL = 'obsidian_metal',
  NEON_GLOW = 'neon_glow',
  STONE_VEIN = 'stone_vein',
  
  // Agent 1: New theme
  QUANTUM_CRYSTAL = 'quantum_crystal',
  
  // Agent 3: Advanced themes
  QUANTUM_MARBLE = 'quantum_marble',
  PRISMATIC_MARBLE = 'prismatic_marble',
  VOLCANIC_MARBLE = 'volcanic_marble'
}

// ============================================================================
// SWARM MATERIAL CONFIGURATIONS
// ============================================================================

export interface SwarmMaterialConfig {
  theme: ExtendedMarbleTheme;
  useAdvancedShaders: boolean;
  enableParticles: boolean;
  lodLevel: LODLevel;
  qualityTier: 'low' | 'medium' | 'high' | 'ultra';
}

export const DefaultSwarmConfig: SwarmMaterialConfig = {
  theme: ExtendedMarbleTheme.CLASSIC_GLASS,
  useAdvancedShaders: true,
  enableParticles: true,
  lodLevel: LODLevel.HIGH,
  qualityTier: 'high'
};

// ============================================================================
// EXTENDED MARBLE VISUAL CLASS
// ============================================================================

export class SwarmMarbleVisual extends MarbleVisual {
  private swarmConfig: SwarmMaterialConfig;
  private swarmMaterial: any = null; // Agent material instance
  private deformationState: {
    impactForce: number;
    recoveryTime: number;
    rollSpeed: number;
    wobblePhase: number;
  } = {
    impactForce: 0,
    recoveryTime: 0,
    rollSpeed: 0,
    wobblePhase: 0
  };
  
  private lastPhysicsState: PhysicsState | null = null;
  private gpuCostEstimate: number = 0;

  constructor(
    engine: Filament.Engine,
    scene: Filament.Scene,
    config: MarbleVisualConfig & { swarmConfig?: Partial<SwarmMaterialConfig> }
  ) {
    // Convert extended theme to base theme for parent constructor
    const baseTheme = convertToBaseTheme(config.theme as unknown as ExtendedMarbleTheme);
    super(engine, scene, { ...config, theme: baseTheme });
    
    this.swarmConfig = { ...DefaultSwarmConfig, ...config.swarmConfig };
    this.gpuCostEstimate = this.estimatePerformanceCost();
    
    // Create swarm-enhanced material if using advanced features
    if (this.swarmConfig.useAdvancedShaders) {
      this.createSwarmMaterial(engine);
    }
  }

  /**
   * Create advanced material based on swarm configuration
   */
  private createSwarmMaterial(engine: Filament.Engine): void {
    switch (this.swarmConfig.theme) {
      case ExtendedMarbleTheme.QUANTUM_CRYSTAL:
        this.swarmMaterial = this.buildQuantumCrystalMaterial(engine);
        break;
      case ExtendedMarbleTheme.QUANTUM_MARBLE:
        this.swarmMaterial = this.buildQuantumMarbleMaterial(engine);
        break;
      case ExtendedMarbleTheme.PRISMATIC_MARBLE:
        this.swarmMaterial = this.buildPrismaticMarbleMaterial(engine);
        break;
      case ExtendedMarbleTheme.VOLCANIC_MARBLE:
        this.swarmMaterial = this.buildVolcanicMarbleMaterial(engine);
        break;
    }
  }

  private buildQuantumCrystalMaterial(engine: Filament.Engine): any {
    // Use Agent 1's refined config with Agent 2's procedural textures
    const config = QuantumCrystalMaterialConfig;
    
    // Generate crystalline vein texture
    const veinTexture = createMarbleVeinTexture({
      primaryColor: '#7329D9',
      secondaryColor: '#00F2FF',
      veinDensity: 0.6,
      turbulence: 0.4
    });
    
    return {
      config,
      textures: { vein: veinTexture },
      gpuCost: 0.42
    };
  }

  private buildQuantumMarbleMaterial(engine: Filament.Engine): any {
    const pkg = QuantumMarblePackage;
    return {
      config: pkg.materialConfig,
      particles: pkg.particleEffects,
      postProcess: pkg.postProcessConfig,
      gpuCost: pkg.materialConfig.performance?.estimatedGpuCost || 0.40
    };
  }

  private buildPrismaticMarbleMaterial(engine: Filament.Engine): any {
    const pkg = PrismaticMarblePackage;
    return {
      config: pkg.materialConfig,
      particles: pkg.particleEffects,
      postProcess: pkg.postProcessConfig,
      gpuCost: pkg.materialConfig.performance?.estimatedGpuCost || 0.45
    };
  }

  private buildVolcanicMarbleMaterial(engine: Filament.Engine): any {
    const pkg = VolcanicMarblePackage;
    return {
      config: pkg.materialConfig,
      particles: pkg.particleEffects,
      postProcess: pkg.postProcessConfig,
      gpuCost: pkg.materialConfig.performance?.estimatedGpuCost || 0.50
    };
  }

  /**
   * Enhanced update with swarm features
   */
  update(deltaTime: number, physicsState?: PhysicsState): void {
    const startTime = performance.now();
    
    // Call base update
    super.update(deltaTime, physicsState);
    
    // Apply swarm enhancements
    if (physicsState) {
      this.lastPhysicsState = physicsState;
      this.updateDeformations(deltaTime, physicsState);
      this.updateAdvancedParticles(deltaTime, physicsState);
    }
    
    // Update shader uniforms for animated effects
    this.updateShaderUniforms(deltaTime);
    
    // Track performance
    const updateTime = performance.now() - startTime;
    this.validatePerformanceBudget(updateTime);
  }

  /**
   * Calculate vertex deformations based on physics
   * Uses Agent 2's deformation functions
   */
  private updateDeformations(deltaTime: number, physics: PhysicsState): void {
    const speed = vec3.length(physics.velocity);
    const angularSpeed = vec3.length(physics.angularVelocity);
    
    // Roll-based flattening
    if (angularSpeed > 2.0) {
      this.deformationState.rollSpeed = angularSpeed;
      const deformation = generateRollFlattening(angularSpeed, 1.0);
      // Apply to renderable (would need mesh access)
    }
    
    // Impact recovery
    if (this.deformationState.recoveryTime > 0) {
      this.deformationState.recoveryTime -= deltaTime;
      const recoveryFactor = this.deformationState.recoveryTime / 0.5;
      const deformation = generateImpactDeformation(
        this.deformationState.impactForce,
        1.0,
        recoveryFactor
      );
    }
    
    // Wobble for high speed
    if (speed > 10.0) {
      this.deformationState.wobblePhase += deltaTime * 10.0;
    }
  }

  /**
   * Trigger impact with deformation
   */
  onContact(impactForce: number): void {
    super.onContact(impactForce);
    
    // Set up deformation
    this.deformationState.impactForce = impactForce;
    this.deformationState.recoveryTime = 0.5; // 500ms recovery
  }

  /**
   * Advanced particle effects
   */
  private updateAdvancedParticles(deltaTime: number, physics: PhysicsState): void {
    if (!this.swarmConfig.enableParticles) return;
    
    const speed = vec3.length(physics.velocity);
    
    // Theme-specific particle triggers
    switch (this.swarmConfig.theme) {
      case ExtendedMarbleTheme.QUANTUM_MARBLE:
        // Entanglement particles at high speed
        if (speed > 8.0 && Math.random() < 0.1) {
          // Spawn quantum particles
        }
        break;
      case ExtendedMarbleTheme.PRISMATIC_MARBLE:
        // Prismatic sparkles on rotation
        if (vec3.length(physics.angularVelocity) > 5.0) {
          // Spawn rainbow sparkles
        }
        break;
      case ExtendedMarbleTheme.VOLCANIC_MARBLE:
        // Ember trails always active
        if (Math.random() < 0.3) {
          // Spawn embers
        }
        break;
    }
  }

  /**
   * Update shader uniforms for animated effects
   */
  private updateShaderUniforms(deltaTime: number): void {
    if (!this.swarmMaterial) return;
    
    // Update time-based uniforms
    const time = performance.now() / 1000.0;
    
    // Would update material uniforms here:
    // this.swarmMaterial.setUniform('uTime', time);
  }

  /**
   * Estimate GPU cost for this marble
   */
  private estimatePerformanceCost(): number {
    if (this.swarmMaterial?.gpuCost) {
      return this.swarmMaterial.gpuCost;
    }
    
    // Base cost by tier
    const tierCosts = {
      low: 0.1,
      medium: 0.25,
      high: 0.4,
      ultra: 0.6
    };
    
    return tierCosts[this.swarmConfig.qualityTier];
  }

  /**
   * Validate performance budget
   */
  private validatePerformanceBudget(actualTime: number): void {
    const budget = 0.5; // 0.5ms target
    if (actualTime > budget * 1.5) {
      console.warn(`[SwarmMarbleVisual] Performance warning: ${actualTime.toFixed(2)}ms > ${budget}ms budget`);
    }
  }

  /**
   * Get current GPU cost estimate
   */
  getGpuCost(): number {
    return this.gpuCostEstimate;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    gpuCost: number;
    theme: ExtendedMarbleTheme;
    qualityTier: string;
    lodLevel: LODLevel;
  } {
    return {
      gpuCost: this.gpuCostEstimate,
      theme: this.swarmConfig.theme,
      qualityTier: this.swarmConfig.qualityTier,
      lodLevel: this.swarmConfig.lodLevel
    };
  }
}

// ============================================================================
// THEME CONVERSION UTILITIES
// ============================================================================

function convertToBaseTheme(extended: ExtendedMarbleTheme): MarbleTheme {
  switch (extended) {
    case ExtendedMarbleTheme.QUANTUM_CRYSTAL:
    case ExtendedMarbleTheme.CLASSIC_GLASS:
      return MarbleTheme.CLASSIC_GLASS;
    case ExtendedMarbleTheme.QUANTUM_MARBLE:
    case ExtendedMarbleTheme.OBSIDIAN_METAL:
    case ExtendedMarbleTheme.VOLCANIC_MARBLE:
      return MarbleTheme.OBSIDIAN_METAL;
    case ExtendedMarbleTheme.NEON_GLOW:
    case ExtendedMarbleTheme.PRISMATIC_MARBLE:
      return MarbleTheme.NEON_GLOW;
    case ExtendedMarbleTheme.STONE_VEIN:
      return MarbleTheme.STONE_VEIN;
    default:
      return MarbleTheme.CLASSIC_GLASS;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createSwarmMarbleVisual(
  engine: Filament.Engine,
  scene: Filament.Scene,
  theme: ExtendedMarbleTheme,
  position: vec3 = vec3.create(),
  swarmConfig?: Partial<SwarmMaterialConfig>
): SwarmMarbleVisual {
  return new SwarmMarbleVisual(engine, scene, {
    theme: theme as unknown as MarbleTheme,
    position,
    rotation: quat.create(),
    swarmConfig
  });
}

/**
 * Get extended theme for marble ID
 */
export function getExtendedThemeForMarble(marbleId: string): ExtendedMarbleTheme {
  const themeMap: Record<string, ExtendedMarbleTheme> = {
    'classic_glass': ExtendedMarbleTheme.CLASSIC_GLASS,
    'classic_blue': ExtendedMarbleTheme.CLASSIC_GLASS,
    'classic_red': ExtendedMarbleTheme.CLASSIC_GLASS,
    'classic_green': ExtendedMarbleTheme.CLASSIC_GLASS,
    'obsidian_metal': ExtendedMarbleTheme.OBSIDIAN_METAL,
    'shadow_ninja': ExtendedMarbleTheme.OBSIDIAN_METAL,
    'neon_glow': ExtendedMarbleTheme.NEON_GLOW,
    'cosmic_nebula': ExtendedMarbleTheme.NEON_GLOW,
    'stone_vein': ExtendedMarbleTheme.STONE_VEIN,
    'volcanic_magma': ExtendedMarbleTheme.VOLCANIC_MARBLE,
    'quantum_crystal': ExtendedMarbleTheme.QUANTUM_CRYSTAL,
    'quantum_marble': ExtendedMarbleTheme.QUANTUM_MARBLE,
    'prismatic_marble': ExtendedMarbleTheme.PRISMATIC_MARBLE
  };
  
  return themeMap[marbleId] || ExtendedMarbleTheme.CLASSIC_GLASS;
}

// ============================================================================
// TRACK MATERIAL INTEGRATION
// ============================================================================

export interface TrackZoneConfig {
  zoneId: string;
  surfaceType: TrackSurfaceType;
  enableWear: boolean;
  reflectionProbeHint?: string;
}

/**
 * Create track material with swarm enhancements
 */
export function createSwarmTrackMaterial(
  engine: Filament.Engine,
  zoneConfig: TrackZoneConfig,
  trafficIntensity: number = 0
): any {
  const material = getTrackMaterialForZone(
    zoneConfig.zoneId,
    zoneConfig.surfaceType,
    zoneConfig.enableWear ? 'high' : 'medium'
  );
  
  // Apply wear if enabled
  if (zoneConfig.enableWear) {
    const wearState = {
      contactCount: trafficIntensity * 100,
      polishedPathIntensity: trafficIntensity * 0.3,
      skidMarkIntensity: trafficIntensity * 0.2,
      dirtAccumulation: trafficIntensity * 0.15,
      heatDiscoloration: trafficIntensity * 0.1
    };
    return applyWearToMaterial(material, wearState);
  }
  
  return material;
}

// ============================================================================
// BATCH UPDATER INTEGRATION
// ============================================================================

export class SwarmTrackManager extends TrackMaterialBatchUpdater {
  private marbleVisuals: SwarmMarbleVisual[] = [];
  
  registerMarble(marble: SwarmMarbleVisual): void {
    this.marbleVisuals.push(marble);
  }
  
  update(deltaTime: number): void {
    super.update(deltaTime);
    
    // Update track wear based on marble traffic
    for (const marble of this.marbleVisuals) {
      const pos = marble.getMetrics(); // Would need actual position
      // Update wear at marble position
    }
  }
}

// ============================================================================
// PERFORMANCE VALIDATION
// ============================================================================

export interface SwarmPerformanceMetrics {
  totalGpuCost: number;
  marbleCount: number;
  averageCostPerMarble: number;
  trackMaterialCost: number;
  withinBudget: boolean;
}

export function validateSwarmPerformance(
  marbleVisuals: SwarmMarbleVisual[],
  trackCost: number = 0
): SwarmPerformanceMetrics {
  const totalGpuCost = marbleVisuals.reduce(
    (sum, m) => sum + m.getGpuCost(), 
    0
  ) + trackCost;
  
  const frameBudget = 8.0; // 8ms for rendering at 60fps
  
  return {
    totalGpuCost,
    marbleCount: marbleVisuals.length,
    averageCostPerMarble: totalGpuCost / marbleVisuals.length,
    trackMaterialCost: trackCost,
    withinBudget: totalGpuCost < frameBudget
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TrackSurfaceType,
  getTrackMaterialForZone,
  generateFBMNoise,
  generateSimplexNoise,
  createMarbleVeinTexture,
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage
};

export default SwarmMarbleVisual;
