import { applyGameLoopSpeedLines } from './speed-lines.js';
import { applyGameLoopRenderCore } from './core.js';

export function applyGameLoopRenderMethods(targetClass) {
    applyGameLoopSpeedLines(targetClass);
    applyGameLoopRenderCore(targetClass);
}
