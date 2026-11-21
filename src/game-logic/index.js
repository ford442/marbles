import { defineSlice } from '../game/systems/slice-composition.ts';
import { GameLogicCollectibles } from './collectibles.js';
import { GameLogicCheckpoints } from './checkpoints.js';
import { GameLogicTricks } from './tricks.js';
import { GameLogicCore } from './core.js';
import { GameLogicLevelComplete } from './level-complete.js';

/** Composed gameplay logic slices; the game forwards each `methods` list to the instance at `key`. */
export const GAME_LOGIC_SLICES = [
    defineSlice('gameLogicCollectiblesSlice', GameLogicCollectibles, [
        'triggerCollectionEffect', 'createCollectionParticle', 'showCollectionScorePopup',
        'worldToScreen', 'triggerCollectionFlash',
    ]),
    defineSlice('gameLogicCheckpointsSlice', GameLogicCheckpoints, [
        'activateCheckpoint', 'triggerCheckpointFlash', 'createCheckpointParticles',
        'createCheckpointRing',
    ]),
    defineSlice('gameLogicTricksSlice', GameLogicTricks, [
        'performStompImpact', 'awardTrickPoints', 'showTrickMessage', 'spawnDriftSparks',
    ]),
    defineSlice('gameLogicCoreSlice', GameLogicCore, ['checkGameLogic']),
    defineSlice('gameLogicLevelCompleteSlice', GameLogicLevelComplete, [
        'setupReplayShareButtons', 'queueLeaderboardGhost', 'refreshLeaderboardSection',
        'setReplayImportStatus', 'copyGhostReplay', 'importGhostReplay', 'showLevelCompleteModal',
        'hideLevelCompleteModal', 'startConfetti', 'stopConfetti', 'resize',
    ]),
];
