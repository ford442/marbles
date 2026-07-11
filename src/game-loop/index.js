import { applyGameLoopLoop } from './loop.js';
import { applyGameLoopLogic } from './logic.js';
import { applyGameLoopFrameInput } from './frame-input.js';
import { applyGameLoopCamera } from './camera.js';
import { applyGameLoopDynamics } from './dynamics-tick.js';
import { applyGameLoopHudTick } from './hud-tick.js';
import { applyGameLoopEffectsTick } from './effects-tick.js';
import { applyGameLoopFinalize } from './finalize-frame.js';
import { applyGameLoopRender } from './render.js';
import { applyGameLoopSync } from './sync.js';
import { applyGameLoopSpeedLines } from './speed-lines.js';

/** @deprecated Use applyGameLoopLoop */
export function applyGameLoopMethods(targetClass) {
    applyGameLoopLoop(targetClass);
    applyGameLoopLogic(targetClass);
}

/** @deprecated Use applyGameLoopRender + applyGameLoopSpeedLines */
export function applyGameLoopRenderMethods(targetClass) {
    applyGameLoopSpeedLines(targetClass);
    applyGameLoopFrameInput(targetClass);
    applyGameLoopCamera(targetClass);
    applyGameLoopDynamics(targetClass);
    applyGameLoopHudTick(targetClass);
    applyGameLoopEffectsTick(targetClass);
    applyGameLoopFinalize(targetClass);
    applyGameLoopRender(targetClass);
}

/** @deprecated Use applyGameLoopSync */
export function applyGameLoopSyncMethods(targetClass) {
    applyGameLoopSync(targetClass);
}

/** Canonical game-loop wiring — single entry used by main.js */
export function applyGameLoop(targetClass) {
    applyGameLoopLoop(targetClass);
    applyGameLoopLogic(targetClass);
    applyGameLoopSpeedLines(targetClass);
    applyGameLoopFrameInput(targetClass);
    applyGameLoopCamera(targetClass);
    applyGameLoopDynamics(targetClass);
    applyGameLoopHudTick(targetClass);
    applyGameLoopEffectsTick(targetClass);
    applyGameLoopFinalize(targetClass);
    applyGameLoopRender(targetClass);
    applyGameLoopSync(targetClass);
}
