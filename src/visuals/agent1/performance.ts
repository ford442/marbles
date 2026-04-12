/**
 * Agent 1: Beauty Layer - Performance Metadata
 * Marble Visual Overhaul Agent Swarm
 * @module agent1/performance
 */

/**
 * Performance metrics for the refined materials
 * All materials are optimized to stay under 0.5ms per marble
 */
export const PerformanceMetrics = {
  /** Maximum estimated GPU cost across all materials */
  maxGpuCost: 0.48,
  /** Average estimated GPU cost */
  avgGpuCost: 0.438,
  /** Budget headroom (0.5ms - max cost) */
  headroom: 0.02,
  /** Materials ordered by GPU cost (ascending) */
  costRanking: [
    { name: 'RefinedStoneVein', cost: 0.38 },
    { name: 'RefinedNeonGlow', cost: 0.42 },
    { name: 'QuantumCrystal', cost: 0.46 },
    { name: 'RefinedClassicGlass', cost: 0.45 },
    { name: 'RefinedObsidianMetal', cost: 0.48 }
  ]
} as const;

/**
 * Quality tier mapping for adaptive rendering
 */
export const QualityTierMapping = {
  low: ['RefinedStoneVein'],
  medium: ['RefinedStoneVein', 'RefinedNeonGlow'],
  high: ['RefinedStoneVein', 'RefinedNeonGlow', 'RefinedClassicGlass', 'RefinedObsidianMetal'],
  ultra: ['RefinedStoneVein', 'RefinedNeonGlow', 'RefinedClassicGlass', 'RefinedObsidianMetal', 'QuantumCrystal']
} as const;
