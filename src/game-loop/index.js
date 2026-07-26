import { installKnownMethods } from '../game/systems/method-installer.js';
import { GameLoopLoop } from './loop.js';
import { GameLoopLogic } from './logic.js';
import { GameLoopSpeedLines } from './speed-lines.js';
import { GameLoopFrameInput } from './frame-input.js';
import { GameLoopCamera } from './camera.js';
import { GameLoopDynamics } from './dynamics-tick.js';
import { GameLoopEffectsTick } from './effects-tick.js';
import { GameLoopFinalize } from './finalize-frame.js';

/**
 * Closed compatibility list for frame behaviors not yet composed.
 * Render/sync and HUD methods are owned by RenderPipeline and HudController.
 */
export function installGameLoopMethods(targetClass) {
    installKnownMethods(targetClass, GameLoopLoop, ['loop']);
    installKnownMethods(targetClass, GameLoopLogic, ['updateGameState']);
    installKnownMethods(targetClass, GameLoopSpeedLines, [
        'initSpeedLines', 'resizeSpeedLinesCanvas', 'createSpeedLine',
        'updateSpeedLines', 'renderSpeedLines',
    ]);
    installKnownMethods(targetClass, GameLoopFrameInput, ['tickFrameInput']);
    installKnownMethods(targetClass, GameLoopCamera, ['updateCamera']);
    installKnownMethods(targetClass, GameLoopDynamics, ['tickSceneDynamics']);
    installKnownMethods(targetClass, GameLoopEffectsTick, ['tickActiveProjectiles']);
    installKnownMethods(targetClass, GameLoopFinalize, ['finalizeFrame']);
}
