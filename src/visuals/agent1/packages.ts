/**
 * Agent 1: Beauty Layer - Rendering Packages
 * Marble Visual Overhaul Agent Swarm
 * @module agent1/packages
 */

import { RefinedMarbleRenderingPackage } from './types';
import {
  RefinedGlassMaterialConfig,
  RefinedObsidianMaterialConfig,
  RefinedNeonMaterialConfig,
  RefinedStoneMaterialConfig,
  QuantumCrystalMaterialConfig
} from './materials';
import {
  RefinedGlassPostProcess,
  RefinedObsidianPostProcess,
  RefinedNeonPostProcess,
  RefinedStonePostProcess,
  QuantumCrystalPostProcess
} from './post-process';

/**
 * Refined Classic Glass Marble Package
 */
export const RefinedClassicGlassMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedClassicGlass',
  materialConfig: RefinedGlassMaterialConfig,
  postProcessConfig: RefinedGlassPostProcess
};

/**
 * Refined Obsidian Metal Marble Package
 */
export const RefinedObsidianMetalMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedObsidianMetal',
  materialConfig: RefinedObsidianMaterialConfig,
  postProcessConfig: RefinedObsidianPostProcess
};

/**
 * Refined Neon Glow Marble Package
 */
export const RefinedNeonGlowMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedNeonGlow',
  materialConfig: RefinedNeonMaterialConfig,
  postProcessConfig: RefinedNeonPostProcess
};

/**
 * Refined Stone Vein Marble Package
 */
export const RefinedStoneVeinMarble: RefinedMarbleRenderingPackage = {
  name: 'RefinedStoneVein',
  materialConfig: RefinedStoneMaterialConfig,
  postProcessConfig: RefinedStonePostProcess
};

/**
 * NEW: Quantum Crystal Marble Package
 */
export const QuantumCrystalMarble: RefinedMarbleRenderingPackage = {
  name: 'QuantumCrystal',
  materialConfig: QuantumCrystalMaterialConfig,
  postProcessConfig: QuantumCrystalPostProcess
};

/**
 * Collection of all refined marble rendering packages
 */
export const AllRefinedMarblePackages: RefinedMarbleRenderingPackage[] = [
  RefinedClassicGlassMarble,
  RefinedObsidianMetalMarble,
  RefinedNeonGlowMarble,
  RefinedStoneVeinMarble,
  QuantumCrystalMarble
];
