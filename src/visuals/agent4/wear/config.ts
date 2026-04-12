/**
 * Agent 4: Track Surface Materials - Wear Configuration
 * Wear simulation configuration interfaces and defaults
 */

/**
 * Wear simulation configuration
 */
export interface WearSimulationConfig {
  /** Wear accumulation per marble contact */
  wearPerContact: number;
  
  /** Dirt accumulation rate per second */
  dirtAccumulationRate: number;
  
  /** Polishing effect from repeated traffic */
  polishPerContact: number;
  
  /** Skid mark intensity from high-speed contacts */
  skidIntensityMultiplier: number;
  
  /** Heat buildup from friction */
  heatPerContact: number;
  
  /** Heat dissipation rate per second */
  heatDissipationRate: number;
  
  /** Maximum wear before surface degradation */
  maxWearThreshold: number;
}

/**
 * Default wear simulation parameters
 */
export const DEFAULT_WEAR_CONFIG: WearSimulationConfig = {
  wearPerContact: 0.001,
  dirtAccumulationRate: 0.0001,
  polishPerContact: 0.002,
  skidIntensityMultiplier: 0.1,
  heatPerContact: 0.05,
  heatDissipationRate: 0.02,
  maxWearThreshold: 1.0
};
