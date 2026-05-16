import { applyGameLogicCollectibles } from './collectibles.js';
import { applyGameLogicCheckpoints } from './checkpoints.js';
import { applyGameLogicTricks } from './tricks.js';
import { applyGameLogicCore } from './core.js';
import { applyGameLogicLevelComplete } from './level-complete.js';

export function applyGameLogicMethods(targetClass) {
    applyGameLogicCollectibles(targetClass);
    applyGameLogicCheckpoints(targetClass);
    applyGameLogicTricks(targetClass);
    applyGameLogicCore(targetClass);
    applyGameLogicLevelComplete(targetClass);
}
