import { installKnownMethods } from '../game/systems/method-installer.js';
import { GameLogicCollectibles } from './collectibles.js';
import { GameLogicCheckpoints } from './checkpoints.js';
import { GameLogicTricks } from './tricks.js';
import { GameLogicCore } from './core.js';
import { GameLogicLevelComplete } from './level-complete.js';

/** Closed compatibility list for gameplay logic that still operates on game state. */
export function installGameLogicMethods(targetClass) {
    installKnownMethods(targetClass, GameLogicCollectibles, [
        'triggerCollectionEffect', 'createCollectionParticle', 'showCollectionScorePopup',
        'worldToScreen', 'triggerCollectionFlash',
    ]);
    installKnownMethods(targetClass, GameLogicCheckpoints, [
        'activateCheckpoint', 'triggerCheckpointFlash', 'createCheckpointParticles', 'createCheckpointRing',
    ]);
    installKnownMethods(targetClass, GameLogicTricks, [
        'performStompImpact', 'awardTrickPoints', 'showTrickMessage', 'spawnDriftSparks',
    ]);
    installKnownMethods(targetClass, GameLogicCore, ['checkGameLogic']);
    installKnownMethods(targetClass, GameLogicLevelComplete, [
        'setupReplayShareButtons', 'queueLeaderboardGhost', 'refreshLeaderboardSection',
        'setReplayImportStatus', 'copyGhostReplay', 'importGhostReplay',
        'showLevelCompleteModal', 'hideLevelCompleteModal', 'startConfetti',
        'stopConfetti', 'resize',
    ]);
}
