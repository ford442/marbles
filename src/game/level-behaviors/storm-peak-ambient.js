/**
 * Storm Peak ambient rain particles and lightning shaft sources.
 * Extracted from zone factory so JSON levels can opt in via behaviors.
 */
import { registerBehavior } from './registry.js';

/** @type {Array<{ remove?: () => void }>} */
let ambientHandles = [];

function findStormPeakOffset(level) {
  const zone = level?.zones?.find((z) => z.type === 'storm_peak');
  const pos = zone?.pos || { x: 0, y: 0, z: 0 };
  return { x: pos.x, y: pos.y, z: pos.z };
}

registerBehavior('storm-peak-ambient', {
  onLoad(game, ctx) {
    ambientHandles = [];
    const pos = findStormPeakOffset(ctx.level);

    if (game.particleSystem) {
      const stormSpots = [
        { x: pos.x, z: pos.z + 40 },
        { x: pos.x, z: pos.z + 85 },
      ];
      for (const spot of stormSpots) {
        game.particleSystem.addAmbientEmitter({
          pos: { x: spot.x, y: pos.y - 10, z: spot.z },
          type: 'spark',
          rate: 20,
          count: 1,
          spread: 5.0,
          velocity: { x: 0, y: 1.0, z: 0 },
          velocitySpread: { x: 5.0, y: 0.5, z: 5.0 },
          params: {
            buoyancy: -0.2,
            lifetime: 3.0,
            size: 0.05,
            color: [0.6, 0.6, 0.8, 0.5],
          },
        });
      }
    }

    if (game.volumetricLights) {
      const lightningFlashes = [
        { x: pos.x - 20, y: pos.y + 10, z: pos.z + 40, color: [0.8, 0.9, 1.0] },
        { x: pos.x + 20, y: pos.y + 20, z: pos.z + 60, color: [0.9, 1.0, 1.0] },
      ];

      for (const s of lightningFlashes) {
        game.volumetricLights.addShaftSource({
          pos: { x: s.x, y: s.y, z: s.z },
          color: s.color,
          intensity: 80000,
          behavior: 'pulse',
          spread: 30,
        });
      }
    }
  },

  onUnload(_game) {
    ambientHandles = [];
  },
});
