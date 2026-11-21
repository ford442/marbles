// @ts-check
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

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */

export class GameLoopCamera {
    /** @param {GameMixinHost} game */
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {number} now
     * @param {boolean} shouldUpdateHUD
     * @param {number} frameDeltaSec
     * @param {number} FOV_CHANGE_THRESHOLD
     * @param {number} ASPECT_CHANGE_THRESHOLD
     */
    updateCamera(now, shouldUpdateHUD, frameDeltaSec, FOV_CHANGE_THRESHOLD, ASPECT_CHANGE_THRESHOLD) {
                if (this.game.view && (!DOF_CAMERA_MODES.has(this.game.cameraMode) || !this.game.currentLevel) && this.game._dofEnabled === true) {
                    try { this.game.view.setDepthOfFieldOptions({ enabled: false }) } catch (e) { /* not supported */ }
                    this.game._dofEnabled = false
                    this.game._dofFocusDistance = null
                }
        
                if ((this.game.cameraMode === 'follow' || this.game.cameraMode === 'action' || this.game.cameraMode === 'fpv' || this.game.cameraMode === 'topdown' || this.game.cameraMode === 'cinematic' || this.game.cameraMode === 'side-scroller' || this.game.cameraMode === 'drone') && this.game.currentLevel) {
                    const level = getLevel(this.game.currentLevel)
                    const target = this.game.playerMarble || this.game.getLeader()
                    if (target) {
                        const t = target.rigidBody.translation()
                        if (this.game.cameraMode === 'follow' || this.game.cameraMode === 'action') {
                            const height = level?.camera?.height || 10
        
                            const linvel = target.rigidBody.linvel()
                            const speed = Math.hypot(linvel.x, linvel.z)
        
                            // Dynamic Distance Scaling
                            const baseDist = this.game.followDist || 20
                            let dist = baseDist + Math.min(speed * 0.5, 15.0)
        
                            let currentHeight = height;
                            if (this.game.cameraMode === 'action') {
                                // Action camera gets lower and closer when fast
                                const speedFactor = Math.min(speed / 30.0, 1.0)
                                currentHeight = height * (1.0 - speedFactor * 0.6)
                                dist = baseDist * (1.0 - speedFactor * 0.3)
                            }
        
                            // Predictive Look-Ahead
                            let lookAheadFactor = Math.min(speed * 0.15, 8.0)
                            if (this.game.cameraMode === 'action') {
                                lookAheadFactor = Math.min(speed * 0.3, 15.0) // Look further ahead in action mode
                            }
                            const normVx = speed > 0.1 ? linvel.x / speed : 0
                            const normVz = speed > 0.1 ? linvel.z / speed : 0
                            const idealLookAtX = t.x + normVx * lookAheadFactor
                            const idealLookAtY = t.y
                            const idealLookAtZ = t.z + normVz * lookAheadFactor
        
                            // Calculate ideal eye position
                            let idealEyeX = t.x - Math.sin(this.game.aimYaw) * dist
                            let idealEyeY = t.y + currentHeight
                            let idealEyeZ = t.z - Math.cos(this.game.aimYaw) * dist
        
                            // Camera Collision Avoidance
                            if (this.game.physicsQueries) {
                                const dx = idealEyeX - t.x
                                const dy = idealEyeY - t.y
                                const dz = idealEyeZ - t.z
                                const distToEye = Math.hypot(dx, dy, dz)
                                const rayDir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye }
        
                                const r = target.scale * 0.5 || 0.5
                                const startDist = r + 0.1
                                const rayOrigin = {
                                    x: t.x + rayDir.x * startDist,
                                    y: t.y + rayDir.y * startDist,
                                    z: t.z + rayDir.z * startDist
                                }
        
                                const maxRayDist = Math.max(0.01, distToEye - startDist)
                                const hit = this.game.physicsQueries.castRay(rayOrigin, rayDir, maxRayDist, {
                                    solid: false,
                                    excludeBody: target.rigidBody,
                                    excludeSensors: true,
                                })
                                if (hit) {
                                    const safeDist = hit.toi - 0.2
                                    if (safeDist > 0) {
                                        idealEyeX = rayOrigin.x + rayDir.x * safeDist
                                        idealEyeY = rayOrigin.y + rayDir.y * safeDist
                                        idealEyeZ = rayOrigin.z + rayDir.z * safeDist
                                    } else {
                                        idealEyeX = rayOrigin.x
                                        idealEyeY = rayOrigin.y
                                        idealEyeZ = rayOrigin.z
                                    }
                                }
                            }
        
                            if (!this.game.cameraFollowPos) {
                                this.game.cameraFollowPos = { x: idealEyeX, y: idealEyeY, z: idealEyeZ }
                                this.game.cameraFollowLookAt = { x: idealLookAtX, y: idealLookAtY, z: idealLookAtZ }
                            } else {
                                // Smoothly interpolate (Lerp) towards ideal positions
                                const lerpFactorPos = 0.1
                                const lerpFactorLook = 0.2
                                this.game.cameraFollowPos.x += (idealEyeX - this.game.cameraFollowPos.x) * lerpFactorPos
                                this.game.cameraFollowPos.y += (idealEyeY - this.game.cameraFollowPos.y) * lerpFactorPos
                                this.game.cameraFollowPos.z += (idealEyeZ - this.game.cameraFollowPos.z) * lerpFactorPos
        
                                this.game.cameraFollowLookAt.x += (idealLookAtX - this.game.cameraFollowLookAt.x) * lerpFactorLook
                                this.game.cameraFollowLookAt.y += (idealLookAtY - this.game.cameraFollowLookAt.y) * lerpFactorLook
                                this.game.cameraFollowLookAt.z += (idealLookAtZ - this.game.cameraFollowLookAt.z) * lerpFactorLook
                            }
        
                            const eyeX = this.game.cameraFollowPos.x + this.game.cameraShake.x
                            const eyeY = this.game.cameraFollowPos.y + this.game.cameraShake.y
                            const eyeZ = this.game.cameraFollowPos.z + this.game.cameraShake.z
        
                            let upVector = [0, 1, 0]
                            if (this.game.isWallRiding && this.game.currentWallNormal) {
                                upVector = [this.game.currentWallNormal.x * 0.5, 1, this.game.currentWallNormal.z * 0.5]
                            }
        
                            this.game.camera.lookAt([eyeX, eyeY, eyeZ], [this.game.cameraFollowLookAt.x, this.game.cameraFollowLookAt.y, this.game.cameraFollowLookAt.z], upVector)
                            this.game._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [this.game.cameraFollowLookAt.x, this.game.cameraFollowLookAt.y, this.game.cameraFollowLookAt.z] }
        
                            // Dynamic FOV scaling based on speed
                            const baseFov = this.game.currentFov || 45
                            const targetFov = baseFov + Math.min(speed * 0.5, 20.0)
                            this.game.activeFov = this.game.activeFov || baseFov
                            this.game.activeFov += (targetFov - this.game.activeFov) * 0.1
        
                            if (this.game.view && this.game.camera && this.game.Filament) {
                                const width = this.game.canvas.width;
                                const height = this.game.canvas.height;
                                const aspect = width / height;
                                const CameraFov = this.game.Filament?.['Camera$Fov'];
                                const fovMode = CameraFov ? CameraFov.VERTICAL : 0;
                                const fovChanged = this.game._lastSetFov === undefined || Math.abs(this.game.activeFov - this.game._lastSetFov) > FOV_CHANGE_THRESHOLD;
                                const aspectChanged = this.game._lastSetProjectionAspect === undefined || Math.abs(aspect - this.game._lastSetProjectionAspect) > ASPECT_CHANGE_THRESHOLD;
                                if (fovChanged || aspectChanged) {
                                    this.game.camera.setProjectionFov(this.game.activeFov, aspect, 0.1, 1000.0, fovMode);
                                    this.game._lastSetFov = this.game.activeFov
                                    this.game._lastSetProjectionAspect = aspect
                                }
                            }
        
                            // DoF for follow/action modes — subtle focus on the marble; only on high/ultra
                            if (this.game.view) {
                                const graphicsQuality = this.game.settings?.graphics?.quality || 'medium'
                                const dofOpts = getDofConfig(this.game.cameraMode, graphicsQuality, dist)
                                if (dofOpts) {
                                    // _dofEnabled starts undefined; !== true is intentional so the first
                                    // frame always initialises DoF, then subsequent frames only update when
                                    // the focus distance has shifted by more than DOF_UPDATE_THRESHOLD.
                                    const shouldUpdateDof = this.game._dofEnabled !== true || Math.abs((this.game._dofFocusDistance || 0) - dist) > DOF_UPDATE_THRESHOLD
                                    if (shouldUpdateDof) {
                                        try {
                                            this.game.view.setDepthOfFieldOptions(dofOpts)
                                            this.game._dofEnabled = true
                                            this.game._dofFocusDistance = dist
                                        } catch (e) { /* DoF not supported */ }
                                    }
                                }
                            }
                        } else if (this.game.cameraMode === 'fpv') {
                            const r = target.scale * 0.5 || 0.5
                            const eyeX = t.x + this.game.cameraShake.x
                            const eyeY = t.y + r + 0.1 + this.game.cameraShake.y
                            const eyeZ = t.z + this.game.cameraShake.z
        
                            const cosP = Math.cos(this.game.pitchAngle)
                            const sinP = Math.sin(this.game.pitchAngle)
                            const dirX = Math.sin(this.game.aimYaw) * cosP
                            const dirY = sinP
                            const dirZ = Math.cos(this.game.aimYaw) * cosP
        
                            let upVector = [0, 1, 0]
                            if (this.game.isWallRiding && this.game.currentWallNormal) {
                                upVector = [this.game.currentWallNormal.x * 0.5, 1, this.game.currentWallNormal.z * 0.5]
                            }
        
                            this.game.camera.lookAt([eyeX, eyeY, eyeZ], [eyeX + dirX, eyeY + dirY, eyeZ + dirZ], upVector)
                            this.game._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [eyeX + dirX, eyeY + dirY, eyeZ + dirZ] }
                        } else if (this.game.cameraMode === 'topdown') {
                            this.game.camera.lookAt([t.x + this.game.cameraShake.x, t.y + 40 + this.game.cameraShake.y, t.z + this.game.cameraShake.z], [t.x, t.y, t.z], [0, 0, -1])
                            this.game._cameraState = { eye: [t.x + this.game.cameraShake.x, t.y + 40 + this.game.cameraShake.y, t.z + this.game.cameraShake.z], target: [t.x, t.y, t.z] }
                        } else if (this.game.cameraMode === 'cinematic') {
                            // Slowly orbit around the target
                            const cinematicAngle = now * 0.0005
                            const dist = 25
                            const height = 15
                            const eyeX = t.x + Math.sin(cinematicAngle) * dist + this.game.cameraShake.x
                            const eyeY = t.y + height + this.game.cameraShake.y
                            const eyeZ = t.z + Math.cos(cinematicAngle) * dist + this.game.cameraShake.z
                            this.game.camera.lookAt([eyeX, eyeY, eyeZ], [t.x, t.y, t.z], [0, 1, 0])
                            this.game._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [t.x, t.y, t.z] }
        
                            // Depth of Field: focus on the marble for cinematic separation
                            if (this.game.view) {
                                const shouldUpdateDof = this.game._dofEnabled !== true || this.game._dofFocusDistance !== dist
                                if (shouldUpdateDof) {
                                    try {
                                        const graphicsQuality = this.game.settings?.graphics?.quality || 'medium'
                                        const dofOpts = getDofConfig('cinematic', graphicsQuality, dist)
                                        if (dofOpts) {
                                            this.game.view.setDepthOfFieldOptions(dofOpts)
                                            this.game._dofEnabled = true
                                            this.game._dofFocusDistance = dist
                                        }
                                    } catch (e) { /* DoF not supported, skip */ }
                                }
                            }
                        } else if (this.game.cameraMode === 'side-scroller') {
                            const dist = 30
                            const height = 5
                            const eyeX = t.x + dist + this.game.cameraShake.x
                            const eyeY = t.y + height + this.game.cameraShake.y
                            const eyeZ = t.z + this.game.cameraShake.z
                            this.game.camera.lookAt([eyeX, eyeY, eyeZ], [t.x, t.y, t.z], [0, 1, 0])
                            this.game._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [t.x, t.y, t.z] }
                        } else if (this.game.cameraMode === 'drone') {
                            const dist = this.game.droneDist || 25.0
        
                            const cosP = Math.cos(this.game.pitchAngle)
                            const sinP = Math.sin(this.game.pitchAngle)
                            const dirX = Math.sin(this.game.aimYaw) * cosP
                            const dirY = sinP
                            const dirZ = Math.cos(this.game.aimYaw) * cosP
        
                            let idealEyeX = t.x - dirX * dist
                            let idealEyeY = t.y - dirY * dist
                            let idealEyeZ = t.z - dirZ * dist
        
                            // Collision Avoidance using Rapier Raycast
                            if (this.game.physicsQueries) {
                                const dx = idealEyeX - t.x
                                const dy = idealEyeY - t.y
                                const dz = idealEyeZ - t.z
                                const distToEye = Math.hypot(dx, dy, dz)
                                const rayDir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye }
        
                                const r = target.scale * 0.5 || 0.5
                                const startDist = r + 0.1
                                const rayOrigin = {
                                    x: t.x + rayDir.x * startDist,
                                    y: t.y + rayDir.y * startDist,
                                    z: t.z + rayDir.z * startDist
                                }
        
                                const maxRayDist = Math.max(0.01, distToEye - startDist)
                                const hit = this.game.physicsQueries.castRay(rayOrigin, rayDir, maxRayDist, {
                                    solid: false,
                                    excludeBody: target.rigidBody,
                                    excludeSensors: true,
                                })
                                if (hit) {
                                    const safeDist = hit.toi - 0.2
                                    if (safeDist > 0) {
                                        idealEyeX = rayOrigin.x + rayDir.x * safeDist
                                        idealEyeY = rayOrigin.y + rayDir.y * safeDist
                                        idealEyeZ = rayOrigin.z + rayDir.z * safeDist
                                    } else {
                                        idealEyeX = rayOrigin.x
                                        idealEyeY = rayOrigin.y
                                        idealEyeZ = rayOrigin.z
                                    }
                                }
                            }
        
                            if (!this.game.cameraFollowPos) {
                                this.game.cameraFollowPos = { x: idealEyeX, y: idealEyeY, z: idealEyeZ }
                                this.game.cameraFollowLookAt = { x: t.x, y: t.y, z: t.z }
                            } else {
                                const lerpFactorPos = 0.08
                                const lerpFactorLook = 0.15
                                this.game.cameraFollowPos.x += (idealEyeX - this.game.cameraFollowPos.x) * lerpFactorPos
                                this.game.cameraFollowPos.y += (idealEyeY - this.game.cameraFollowPos.y) * lerpFactorPos
                                this.game.cameraFollowPos.z += (idealEyeZ - this.game.cameraFollowPos.z) * lerpFactorPos
        
                                this.game.cameraFollowLookAt.x += (t.x - this.game.cameraFollowLookAt.x) * lerpFactorLook
                                this.game.cameraFollowLookAt.y += (t.y - this.game.cameraFollowLookAt.y) * lerpFactorLook
                                this.game.cameraFollowLookAt.z += (t.z - this.game.cameraFollowLookAt.z) * lerpFactorLook
                            }
        
                            const eyeX = this.game.cameraFollowPos.x + this.game.cameraShake.x
                            const eyeY = this.game.cameraFollowPos.y + this.game.cameraShake.y
                            const eyeZ = this.game.cameraFollowPos.z + this.game.cameraShake.z
        
                            let upVector = [0, 1, 0]
                            if (this.game.isWallRiding && this.game.currentWallNormal) {
                                upVector = [this.game.currentWallNormal.x * 0.5, 1, this.game.currentWallNormal.z * 0.5]
                            }
        
                            this.game.camera.lookAt([eyeX, eyeY, eyeZ], [this.game.cameraFollowLookAt.x, this.game.cameraFollowLookAt.y, this.game.cameraFollowLookAt.z], upVector)
                            this.game._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [this.game.cameraFollowLookAt.x, this.game.cameraFollowLookAt.y, this.game.cameraFollowLookAt.z] }
                        }
                    }
                } else {
                    const target = this.game.playerMarble || this.game.getLeader();
                    let targetX = 0, targetY = 0, targetZ = 0;
        
                    if (target && target.rigidBody) {
                        const t = target.rigidBody.translation();
                        targetX = t.x;
                        targetY = t.y;
                        targetZ = t.z;
                    }
        
                    let idealEyeX = targetX + this.game.camRadius * Math.sin(this.game.camAngle);
                    let idealEyeY = targetY + this.game.camHeight;
                    let idealEyeZ = targetZ + this.game.camRadius * Math.cos(this.game.camAngle);
        
                    if (this.game.physicsQueries) {
                        const dx = idealEyeX - targetX;
                        const dy = idealEyeY - targetY;
                        const dz = idealEyeZ - targetZ;
                        const distToEye = Math.hypot(dx, dy, dz);
        
                        if (distToEye > 0.001) {
                            const rayDir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye };
                            const r = target ? (target.scale * 0.5 || 0.5) : 0.5;
                            const startDist = r + 0.1;
                            const rayOrigin = {
                                x: targetX + rayDir.x * startDist,
                                y: targetY + rayDir.y * startDist,
                                z: targetZ + rayDir.z * startDist
                            };
        
                            const maxRayDist = Math.max(0.01, distToEye - startDist);
                            const hit = this.game.physicsQueries.castRay(rayOrigin, rayDir, maxRayDist, {
                                solid: false,
                                excludeBody: target?.rigidBody,
                                excludeSensors: true,
                            });
        
                            if (hit) {
                                const safeDist = hit.toi - 0.2;
                                if (safeDist > 0) {
                                    idealEyeX = rayOrigin.x + rayDir.x * safeDist;
                                    idealEyeY = rayOrigin.y + rayDir.y * safeDist;
                                    idealEyeZ = rayOrigin.z + rayDir.z * safeDist;
                                } else {
                                    idealEyeX = rayOrigin.x;
                                    idealEyeY = rayOrigin.y;
                                    idealEyeZ = rayOrigin.z;
                                }
                            }
                        }
                    }
        
                    const eyeX = idealEyeX + this.game.cameraShake.x;
                    const eyeY = idealEyeY + this.game.cameraShake.y;
                    const eyeZ = idealEyeZ + this.game.cameraShake.z;
                    this.game.camera.lookAt([eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 1, 0]);
                    this.game._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [targetX, targetY, targetZ] };
                }
    }
}
