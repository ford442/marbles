import { defineSlice, type SliceSpec } from '../game/systems/slice-composition.ts';
import type { FrameHost } from '../types/frame-host.ts';
import { GameLoopLoop, type GameLoopHost } from './loop.ts';
import { GameLoopLogic } from './logic.js';
import { GameLoopSpeedLines } from './speed-lines.js';
import { GameLoopFrameInput, type GameLoopFrameInputHost } from './frame-input.ts';
import { GameLoopCamera, type GameLoopCameraHost } from './camera.ts';
import { GameLoopDynamics } from './dynamics-tick.js';
import { GameLoopEffectsTick, type GameLoopEffectsTickHost } from './effects-tick.ts';
import { GameLoopFinalize } from './finalize-frame.js';

/**
 * Everything the composed per-frame slices read on the game: the frame slices
 * typed against `FrameHost` (logic, speed lines, dynamics, finalize) plus the
 * narrow hosts of the rest. `RenderPipeline` (sync) and `HudController`
 * (cooldown bars) own their own hosts.
 */
export type GameLoopSlicesHost =
    & GameLoopHost
    & FrameHost
    & GameLoopFrameInputHost
    & GameLoopCameraHost
    & GameLoopEffectsTickHost;

/** Composed per-frame slices (render/sync and HUD ticks are owned by RenderPipeline and HudController); the game forwards each `methods` list to the instance at `key`. */
export const GAME_LOOP_SLICES: SliceSpec<GameLoopSlicesHost>[] = [
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
