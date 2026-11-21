// @ts-check
/** @typedef {import('../types/frame-host.ts').FrameHost} FrameHost */
import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.ts';
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
} from './helpers.ts';

export class GameLoopFinalize {
    /** @param {FrameHost} game */
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {number} now
     * @param {number} culledPowerUps
     * @param {number} culledCollectibles
     * @param {boolean} [shouldUpdateHUD]
     */
    finalizeFrame(now, culledPowerUps, culledCollectibles, shouldUpdateHUD = true) {
                this.game.hudController?.updateFrame(now, { shouldUpdateHUD })
        
                this.game.perfMonitor?.recordCoreWork({
                    movingPlatforms: this.game.movingPlatforms?.length || 0,
                    rotatingPlatforms: this.game.rotatingPlatforms?.length || 0,
                    powerUps: this.game.powerUps?.length || 0,
                    culledPowerUps,
                    collectibles: this.game.collectibles?.length || 0,
                    culledCollectibles,
                    activeBlackHoles: this.game.activeBlackHoles?.length || 0,
                    activeBombs: this.game.activeBombs?.length || 0,
                    activeMissiles: this.game.activeMissiles?.length || 0,
                    estimatedTransformSets:
                        (this.game.movingPlatforms?.length || 0) +
                        (this.game.rotatingPlatforms?.length || 0) +
                        Math.max(0, (this.game.powerUps?.length || 0) - culledPowerUps) +
                        Math.max(0, (this.game.collectibles?.length || 0) - culledCollectibles) +
                        (this.game.activeBlackHoles?.length || 0) +
                        (this.game.activeBombs?.length || 0) +
                        (this.game.activeMissiles?.length || 0)
                })
        
    }
}
