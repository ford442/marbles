/**
 * Marble package loader
 */

import {
  MarbleRenderingPackage,
  ClassicGlassMarble,
  ObsidianMetalMarble,
  NeonGlowMarble,
  StoneVeinMarble
} from '../../marble_rendering_layer';

export function loadMarblePackage(type: string): MarbleRenderingPackage | null {
  switch (type) {
    case 'ClassicGlass': return ClassicGlassMarble;
    case 'ObsidianMetal': return ObsidianMetalMarble;
    case 'NeonGlow': return NeonGlowMarble;
    case 'StoneVein': return StoneVeinMarble;
    default: return null;
  }
}
