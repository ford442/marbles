/**
 * Agent 1: Beauty Layer - Color Palettes
 * Marble Visual Overhaul Agent Swarm
 * @module agent1/palettes
 */

/**
 * Color palette for the Quantum Crystal theme
 * Inspired by quantum energy states and crystalline structures
 */
export const QuantumCrystalPalette = {
  /** Core crystal violet - base color */
  coreViolet: [0.45, 0.12, 0.85] as [number, number, number],
  /** Energy cyan - emission/accent */
  energyCyan: [0.0, 0.95, 1.0] as [number, number, number],
  /** Phase magenta - interference patterns */
  phaseMagenta: [0.95, 0.0, 0.65] as [number, number, number],
  /** Void black - deep absorption areas */
  voidBlack: [0.02, 0.0, 0.08] as [number, number, number],
  /** Prism white - highlight peaks */
  prismWhite: [0.98, 0.95, 1.0] as [number, number, number],
  /** Entanglement gold - rare accents */
  entanglementGold: [1.0, 0.85, 0.3] as [number, number, number],
  /** Superposition gradient - for iridescence */
  superposition: {
    low: [0.2, 0.0, 0.5] as [number, number, number],
    mid: [0.5, 0.2, 0.8] as [number, number, number],
    high: [0.0, 0.8, 1.0] as [number, number, number]
  }
} as const;

/**
 * Enhanced color palettes for existing marble types
 */
export const EnhancedColorPalettes = {
  glass: {
    base: [0.15, 0.35, 0.55] as [number, number, number],
    rim: [0.6, 0.9, 1.0] as [number, number, number],
    caustic: [1.0, 0.95, 0.75] as [number, number, number],
    absorption: [0.05, 0.15, 0.25] as [number, number, number]
  },
  obsidian: {
    base: [0.02, 0.02, 0.03] as [number, number, number],
    metallic: [0.12, 0.12, 0.15] as [number, number, number],
    heat: [0.8, 0.3, 0.05] as [number, number, number],
    scratch: [0.3, 0.3, 0.35] as [number, number, number]
  },
  neon: {
    core: [0.0, 1.0, 0.9] as [number, number, number],
    pulse: [1.0, 0.0, 0.6] as [number, number, number],
    circuit: [0.4, 0.0, 1.0] as [number, number, number],
    bloom: [0.2, 1.0, 1.0] as [number, number, number]
  },
  stone: {
    base: [0.88, 0.85, 0.80] as [number, number, number],
    vein: [0.35, 0.30, 0.40] as [number, number, number],
    sssWarm: [1.0, 0.82, 0.65] as [number, number, number],
    sparkle: [1.0, 0.97, 0.88] as [number, number, number]
  }
} as const;
