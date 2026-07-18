import RAPIER from '@dimforge/rapier3d-compat';
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

export class GameLoopFinalize {
    finalizeFrame(now, culledPowerUps, culledCollectibles) {
                // Update consolidated HUD
                if (this.hudManager) {
                    this.hudManager.updateAllAbilities()
                }
        
                this.perfMonitor?.recordCoreWork({
                    movingPlatforms: this.movingPlatforms?.length || 0,
                    rotatingPlatforms: this.rotatingPlatforms?.length || 0,
                    powerUps: this.powerUps?.length || 0,
                    culledPowerUps,
                    collectibles: this.collectibles?.length || 0,
                    culledCollectibles,
                    activeBlackHoles: this.activeBlackHoles?.length || 0,
                    activeBombs: this.activeBombs?.length || 0,
                    activeMissiles: this.activeMissiles?.length || 0,
                    estimatedTransformSets:
                        (this.movingPlatforms?.length || 0) +
                        (this.rotatingPlatforms?.length || 0) +
                        Math.max(0, (this.powerUps?.length || 0) - culledPowerUps) +
                        Math.max(0, (this.collectibles?.length || 0) - culledCollectibles) +
                        (this.activeBlackHoles?.length || 0) +
                        (this.activeBombs?.length || 0) +
                        (this.activeMissiles?.length || 0)
                })
        
                // Update goal zone effects
                if (this.playerMarble) {
                    const playerPos = this.playerMarble.rigidBody.translation()
                    this.updateGoalEffects(0.016, playerPos)
                }
    }
}

export function applyGameLoopFinalize(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopFinalize.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopFinalize.prototype[name];
        }
    }
}
