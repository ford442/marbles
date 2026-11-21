import { defineSlice } from '../game/systems/slice-composition.ts';
import { GameLoopLoop } from './loop.ts';
import { GameLoopLogic } from './logic.js';
import { GameLoopSpeedLines } from './speed-lines.js';
import { GameLoopFrameInput } from './frame-input.js';
import { GameLoopCamera } from './camera.js';
import { GameLoopDynamics } from './dynamics-tick.js';
import { GameLoopEffectsTick } from './effects-tick.js';
import { GameLoopFinalize } from './finalize-frame.js';

/** Composed per-frame slices (render/sync and HUD ticks are owned by RenderPipeline and HudController); the game forwards each `methods` list to the instance at `key`. */
export const GAME_LOOP_SLICES = [
    defineSlice('gameLoopLoopSlice', GameLoopLoop, ['loop']),
    defineSlice('gameLoopLogicSlice', GameLoopLogic, ['updateGameState']),
    defineSlice('gameLoopSpeedLinesSlice', GameLoopSpeedLines, [
        'initSpeedLines', 'resizeSpeedLinesCanvas', 'createSpeedLine', 'updateSpeedLines',
        'renderSpeedLines',
    ]),
    defineSlice('gameLoopFrameInputSlice', GameLoopFrameInput, ['tickFrameInput']),
    defineSlice('gameLoopCameraSlice', GameLoopCamera, ['updateCamera']),
    defineSlice('gameLoopDynamicsSlice', GameLoopDynamics, ['tickSceneDynamics']),
    defineSlice('gameLoopEffectsTickSlice', GameLoopEffectsTick, ['tickActiveProjectiles']),
    defineSlice('gameLoopFinalizeSlice', GameLoopFinalize, ['finalizeFrame']),
];
