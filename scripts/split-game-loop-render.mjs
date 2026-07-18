#!/usr/bin/env node
/**
 * One-shot splitter for game-loop/render.js → focused modules.
 * Run from repo root: node scripts/split-game-loop-render.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RENDER = path.join(ROOT, 'src/game-loop/render.js');
const lines = fs.readFileSync(RENDER, 'utf8').split('\n');

const slice = (start, end) => lines.slice(start - 1, end).join('\n');

const HEADER_IMPORTS = `import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.js';
import { getLevel } from '../levels/catalog.js';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';
import { getDofConfig } from '../rendering/post-fx-presets.js';
import {
    getCachedTransformInstance,
    transformChanged,
    scaledTransform,
    setColor3IfChanged,
    DOF_CAMERA_MODES,
    DOF_UPDATE_THRESHOLD,
} from './helpers.js';
`;

function mixinFile(className, applyName, methodName, params, body, extraImports = '') {
    return `${extraImports}${HEADER_IMPORTS}
export class ${className} {
    ${methodName}(${params}) {
${body}
    }
}

export function ${applyName}(targetClass) {
    for (const name of Object.getOwnPropertyNames(${className}.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ${className}.prototype[name];
        }
    }
}
`;
}

// renderAndSync body slices (1-based inclusive line numbers in original render.js)
const frameInputBody = slice(86, 315);
const cameraBody = slice(317, 660);
// dynamics body needs cull counters
const dynamicsBody = `        let culledPowerUps = 0
        let culledCollectibles = 0
` + slice(662, 856);
const hudBody = slice(858, 1010);
const projectilesBody = slice(1012, 1256);
const finalizeBody = slice(1258, 1287);

fs.writeFileSync(path.join(ROOT, 'src/game-loop/helpers.js'), `export const DOF_CAMERA_MODES = new Set(['cinematic', 'follow', 'action'])
export const DOF_UPDATE_THRESHOLD = 1.0
const CORE_TRANSFORM_POS_EPS_SQ = 0.000001
const CORE_TRANSFORM_ROT_EPS_SQ = 0.000001
const CORE_COLOR_EPS = 1 / 255

${slice(16, 66)}
`);

fs.writeFileSync(
    path.join(ROOT, 'src/game-loop/frame-input.js'),
    mixinFile(
        'GameLoopFrameInput',
        'applyGameLoopFrameInput',
        'tickFrameInput',
        'now, shouldUpdateHUD, frameDeltaSec, rotSpeed, zoomSpeed',
        frameInputBody.split('\n').map((l) => '        ' + l).join('\n')
    )
);

fs.writeFileSync(
    path.join(ROOT, 'src/game-loop/camera.js'),
    mixinFile(
        'GameLoopCamera',
        'applyGameLoopCamera',
        'updateCamera',
        'now, shouldUpdateHUD, frameDeltaSec, FOV_CHANGE_THRESHOLD, ASPECT_CHANGE_THRESHOLD',
        cameraBody.split('\n').map((l) => '        ' + l).join('\n')
    )
);

fs.writeFileSync(
    path.join(ROOT, 'src/game-loop/dynamics-tick.js'),
    mixinFile(
        'GameLoopDynamics',
        'applyGameLoopDynamics',
        'tickSceneDynamics',
        'now',
        dynamicsBody.split('\n').map((l) => '        ' + l).join('\n')
    )
);

fs.writeFileSync(
    path.join(ROOT, 'src/game-loop/hud-tick.js'),
    mixinFile(
        'GameLoopHudTick',
        'applyGameLoopHudTick',
        'tickHudCooldownBars',
        'now, shouldUpdateHUD',
        hudBody.split('\n').map((l) => '        ' + l).join('\n')
    )
);

fs.writeFileSync(
    path.join(ROOT, 'src/game-loop/effects-tick.js'),
    mixinFile(
        'GameLoopEffectsTick',
        'applyGameLoopEffectsTick',
        'tickActiveProjectiles',
        'now',
        projectilesBody.split('\n').map((l) => '        ' + l).join('\n')
    )
);

fs.writeFileSync(
    path.join(ROOT, 'src/game-loop/finalize-frame.js'),
    mixinFile(
        'GameLoopFinalize',
        'applyGameLoopFinalize',
        'finalizeFrame',
        'now, culledPowerUps, culledCollectibles',
        finalizeBody.split('\n').map((l) => '        ' + l).join('\n')
    )
);

const orchestrator = `import {
    DOF_CAMERA_MODES,
} from './helpers.js';

export class GameLoopRender {
    renderAndSync() {
        const now = Date.now()
        this.perfMonitor?.beginFrame()
        const INITIAL_FRAME_DELTA_SEC = 1 / 60
        const frameDeltaSec = this._lastRenderTick ? (now - this._lastRenderTick) / 1000 : INITIAL_FRAME_DELTA_SEC
        this._lastRenderTick = now
        const FOV_CHANGE_THRESHOLD = 0.25
        const ASPECT_CHANGE_THRESHOLD = 0.001
        const shouldUpdateHUD = (now - (this._lastHudStyleUpdate || 0)) >= 100
        if (shouldUpdateHUD) this._lastHudStyleUpdate = now
        let culledPowerUps = 0
        let culledCollectibles = 0
        const rotSpeed = 0.02
        const zoomSpeed = 0.5

        this.tickFrameInput(now, shouldUpdateHUD, frameDeltaSec, rotSpeed, zoomSpeed)
        this.updateCamera(now, shouldUpdateHUD, frameDeltaSec, FOV_CHANGE_THRESHOLD, ASPECT_CHANGE_THRESHOLD)
        const dynamicsCull = this.tickSceneDynamics(now)
        culledPowerUps = dynamicsCull.culledPowerUps
        culledCollectibles = dynamicsCull.culledCollectibles
        this.tickHudCooldownBars(now, shouldUpdateHUD)
        this.tickActiveProjectiles(now)
        this.finalizeFrame(now, culledPowerUps, culledCollectibles)
        this.syncTransformsAndRender(now)
    }
}

export function applyGameLoopRender(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopRender.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopRender.prototype[name];
        }
    }
}
`;

fs.writeFileSync(path.join(ROOT, 'src/game-loop/render.js'), orchestrator);

// Fix dynamics to return cull counts
const dynPath = path.join(ROOT, 'src/game-loop/dynamics-tick.js');
let dyn = fs.readFileSync(dynPath, 'utf8');
if (!dyn.includes('return { culledPowerUps')) {
    dyn = dyn.replace(
        /(\s+)}\n}\n\nexport function applyGameLoopDynamics/,
        `$1    return { culledPowerUps, culledCollectibles }\n    }\n}\n\nexport function applyGameLoopDynamics`
    );
    fs.writeFileSync(dynPath, dyn);
}

console.log('Split render.js into game-loop modules.');
