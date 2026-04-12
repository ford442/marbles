/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Marble Rendering Packages
 */

import { MarbleRenderingPackage } from './types';
import {
  GlassMaterialConfig,
  ObsidianMaterialConfig,
  NeonMaterialConfig,
  StoneMaterialConfig
} from './materials/configs';
import {
  SpeedSparkleEffect,
  ImpactBurstEffect,
  BoostFlameEffect,
  NeonTrailEffect
} from './effects/particles';
import {
  GlassPostProcess,
  ObsidianPostProcess,
  NeonPostProcess,
  StonePostProcess
} from './effects/post-process';
import { DefaultMarbleLOD } from './lod';

export const ClassicGlassMarble: MarbleRenderingPackage = {
  name: 'ClassicGlass',
  materialConfig: GlassMaterialConfig,
  particleEffects: [SpeedSparkleEffect, ImpactBurstEffect],
  postProcessConfig: GlassPostProcess,
  lodConfig: DefaultMarbleLOD
};

export const ObsidianMetalMarble: MarbleRenderingPackage = {
  name: 'ObsidianMetal',
  materialConfig: ObsidianMaterialConfig,
  particleEffects: [SpeedSparkleEffect, ImpactBurstEffect],
  postProcessConfig: ObsidianPostProcess,
  lodConfig: DefaultMarbleLOD
};

export const NeonGlowMarble: MarbleRenderingPackage = {
  name: 'NeonGlow',
  materialConfig: NeonMaterialConfig,
  particleEffects: [NeonTrailEffect, BoostFlameEffect, ImpactBurstEffect],
  postProcessConfig: NeonPostProcess,
  lodConfig: DefaultMarbleLOD
};

export const StoneVeinMarble: MarbleRenderingPackage = {
  name: 'StoneVein',
  materialConfig: StoneMaterialConfig,
  particleEffects: [SpeedSparkleEffect],
  postProcessConfig: StonePostProcess,
  lodConfig: DefaultMarbleLOD
};

// All marbles collection
export const AllMarbleRenderingPackages: MarbleRenderingPackage[] = [
  ClassicGlassMarble,
  ObsidianMetalMarble,
  NeonGlowMarble,
  StoneVeinMarble
];
