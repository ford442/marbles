import { defineSlice } from '../game/systems/slice-composition.ts';
import type { SliceSpec } from '../game/systems/slice-composition.ts';
import { GameLogicCollectibles } from './collectibles.ts';
import type { GameLogicCollectiblesHost } from './collectibles.ts';
import { GameLogicCheckpoints } from './checkpoints.ts';
import type { GameLogicCheckpointsHost } from './checkpoints.ts';
import { GameLogicTricks } from './tricks.ts';
import type { GameLogicTricksHost } from './tricks.ts';
import { GameLogicCore } from './core.ts';
import type { GameLogicCoreHost } from './core.ts';
import { GameLogicLevelComplete } from './level-complete.ts';
import type { GameLogicLevelCompleteHost } from './level-complete.ts';

/** Everything the gameplay logic slices use on the game. */
export type GameLogicSlicesHost =
    & GameLogicCollectiblesHost
    & GameLogicCheckpointsHost
    & GameLogicTricksHost
    & GameLogicCoreHost
    & GameLogicLevelCompleteHost;

/** Composed gameplay logic slices; the game forwards each `methods` list to the instance at `key`. */
export const GAME_LOGIC_SLICES: SliceSpec<GameLogicSlicesHost>[] = [
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
