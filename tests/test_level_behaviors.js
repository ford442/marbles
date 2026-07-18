/**
 * Level behavior registry smoke test.
 */
import { BEHAVIOR_REGISTRY } from '../src/game/level-behaviors/registry.js';
import '../src/game/level-behaviors/storm-peak-ambient.js';
import {
  loadLevelBehaviors,
  unloadLevelBehaviors,
  getActiveBehaviorIds,
} from '../src/game/level-behaviors/index.js';

console.log('test_level_behaviors.js');

console.assert(BEHAVIOR_REGISTRY.has('storm-peak-ambient'), 'storm-peak-ambient registered');

const fakeGame = {
  currentLevel: 'storm_peak',
  particleSystem: { addAmbientEmitter: () => {} },
  volumetricLights: { addShaftSource: () => {} },
};

loadLevelBehaviors(fakeGame, ['storm-peak-ambient'], {
  levelId: 'storm_peak',
  level: {
    zones: [{ type: 'storm_peak', pos: { x: 1, y: 2, z: 3 } }],
  },
});

console.assert(
  getActiveBehaviorIds().includes('storm-peak-ambient'),
  'behavior active after load'
);

unloadLevelBehaviors(fakeGame);
console.assert(getActiveBehaviorIds().length === 0, 'behaviors cleared on unload');

console.log('✓ Level behaviors OK');
