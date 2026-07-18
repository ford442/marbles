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

export class GameLoopCamera {
    updateCamera(now, shouldUpdateHUD, frameDeltaSec, FOV_CHANGE_THRESHOLD, ASPECT_CHANGE_THRESHOLD) {
                if (this.view && (!DOF_CAMERA_MODES.has(this.cameraMode) || !this.currentLevel) && this._dofEnabled === true) {
                    try { this.view.setDepthOfFieldOptions({ enabled: false }) } catch (e) { /* not supported */ }
                    this._dofEnabled = false
                    this._dofFocusDistance = null
                }
        
                if ((this.cameraMode === 'follow' || this.cameraMode === 'action' || this.cameraMode === 'fpv' || this.cameraMode === 'topdown' || this.cameraMode === 'cinematic' || this.cameraMode === 'side-scroller' || this.cameraMode === 'drone') && this.currentLevel) {
                    const level = getLevel(this.currentLevel)
                    const target = this.playerMarble || this.getLeader()
                    if (target) {
                        const t = target.rigidBody.translation()
                        if (this.cameraMode === 'follow' || this.cameraMode === 'action') {
                            const height = level?.camera?.height || 10
        
                            const linvel = target.rigidBody.linvel()
                            const speed = Math.hypot(linvel.x, linvel.z)
        
                            // Dynamic Distance Scaling
                            const baseDist = this.followDist || 20
                            let dist = baseDist + Math.min(speed * 0.5, 15.0)
        
                            let currentHeight = height;
                            if (this.cameraMode === 'action') {
                                // Action camera gets lower and closer when fast
                                const speedFactor = Math.min(speed / 30.0, 1.0)
                                currentHeight = height * (1.0 - speedFactor * 0.6)
                                dist = baseDist * (1.0 - speedFactor * 0.3)
                            }
        
                            // Predictive Look-Ahead
                            let lookAheadFactor = Math.min(speed * 0.15, 8.0)
                            if (this.cameraMode === 'action') {
                                lookAheadFactor = Math.min(speed * 0.3, 15.0) // Look further ahead in action mode
                            }
                            const normVx = speed > 0.1 ? linvel.x / speed : 0
                            const normVz = speed > 0.1 ? linvel.z / speed : 0
                            const idealLookAtX = t.x + normVx * lookAheadFactor
                            const idealLookAtY = t.y
                            const idealLookAtZ = t.z + normVz * lookAheadFactor
        
                            // Calculate ideal eye position
                            let idealEyeX = t.x - Math.sin(this.aimYaw) * dist
                            let idealEyeY = t.y + currentHeight
                            let idealEyeZ = t.z - Math.cos(this.aimYaw) * dist
        
                            // Camera Collision Avoidance
                            if (this.world && typeof RAPIER !== 'undefined') {
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
        
                                const ray = new RAPIER.Ray(rayOrigin, rayDir)
        
                                const maxRayDist = Math.max(0.01, distToEye - startDist)
                                const hit = this.world.castRay(ray, maxRayDist, false)
                                if (hit) {
                                    const otherBody = hit.collider.parent()
                                    if (!otherBody || (otherBody.handle !== target.rigidBody.handle && !hit.collider.isSensor())) {
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
                            }
        
                            if (!this.cameraFollowPos) {
                                this.cameraFollowPos = { x: idealEyeX, y: idealEyeY, z: idealEyeZ }
                                this.cameraFollowLookAt = { x: idealLookAtX, y: idealLookAtY, z: idealLookAtZ }
                            } else {
                                // Smoothly interpolate (Lerp) towards ideal positions
                                const lerpFactorPos = 0.1
                                const lerpFactorLook = 0.2
                                this.cameraFollowPos.x += (idealEyeX - this.cameraFollowPos.x) * lerpFactorPos
                                this.cameraFollowPos.y += (idealEyeY - this.cameraFollowPos.y) * lerpFactorPos
                                this.cameraFollowPos.z += (idealEyeZ - this.cameraFollowPos.z) * lerpFactorPos
        
                                this.cameraFollowLookAt.x += (idealLookAtX - this.cameraFollowLookAt.x) * lerpFactorLook
                                this.cameraFollowLookAt.y += (idealLookAtY - this.cameraFollowLookAt.y) * lerpFactorLook
                                this.cameraFollowLookAt.z += (idealLookAtZ - this.cameraFollowLookAt.z) * lerpFactorLook
                            }
        
                            const eyeX = this.cameraFollowPos.x + this.cameraShake.x
                            const eyeY = this.cameraFollowPos.y + this.cameraShake.y
                            const eyeZ = this.cameraFollowPos.z + this.cameraShake.z
        
                            let upVector = [0, 1, 0]
                            if (this.isWallRiding && this.currentWallNormal) {
                                upVector = [this.currentWallNormal.x * 0.5, 1, this.currentWallNormal.z * 0.5]
                            }
        
                            this.camera.lookAt([eyeX, eyeY, eyeZ], [this.cameraFollowLookAt.x, this.cameraFollowLookAt.y, this.cameraFollowLookAt.z], upVector)
                            this._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [this.cameraFollowLookAt.x, this.cameraFollowLookAt.y, this.cameraFollowLookAt.z] }
        
                            // Dynamic FOV scaling based on speed
                            const baseFov = this.currentFov || 45
                            const targetFov = baseFov + Math.min(speed * 0.5, 20.0)
                            this.activeFov = this.activeFov || baseFov
                            this.activeFov += (targetFov - this.activeFov) * 0.1
        
                            if (this.view && this.camera && this.Filament) {
                                const width = this.canvas.width;
                                const height = this.canvas.height;
                                const aspect = width / height;
                                const CameraFov = this.Filament?.['Camera$Fov'];
                                const fovMode = CameraFov ? CameraFov.VERTICAL : 0;
                                const fovChanged = this._lastSetFov === undefined || Math.abs(this.activeFov - this._lastSetFov) > FOV_CHANGE_THRESHOLD;
                                const aspectChanged = this._lastSetProjectionAspect === undefined || Math.abs(aspect - this._lastSetProjectionAspect) > ASPECT_CHANGE_THRESHOLD;
                                if (fovChanged || aspectChanged) {
                                    this.camera.setProjectionFov(this.activeFov, aspect, 0.1, 1000.0, fovMode);
                                    this._lastSetFov = this.activeFov
                                    this._lastSetProjectionAspect = aspect
                                }
                            }
        
                            // DoF for follow/action modes — subtle focus on the marble; only on high/ultra
                            if (this.view) {
                                const graphicsQuality = this.settings?.graphics?.quality || 'medium'
                                const dofOpts = getDofConfig(this.cameraMode, graphicsQuality, dist)
                                if (dofOpts) {
                                    // _dofEnabled starts undefined; !== true is intentional so the first
                                    // frame always initialises DoF, then subsequent frames only update when
                                    // the focus distance has shifted by more than DOF_UPDATE_THRESHOLD.
                                    const shouldUpdateDof = this._dofEnabled !== true || Math.abs((this._dofFocusDistance || 0) - dist) > DOF_UPDATE_THRESHOLD
                                    if (shouldUpdateDof) {
                                        try {
                                            this.view.setDepthOfFieldOptions(dofOpts)
                                            this._dofEnabled = true
                                            this._dofFocusDistance = dist
                                        } catch (e) { /* DoF not supported */ }
                                    }
                                }
                            }
                        } else if (this.cameraMode === 'fpv') {
                            const r = target.scale * 0.5 || 0.5
                            const eyeX = t.x + this.cameraShake.x
                            const eyeY = t.y + r + 0.1 + this.cameraShake.y
                            const eyeZ = t.z + this.cameraShake.z
        
                            const cosP = Math.cos(this.pitchAngle)
                            const sinP = Math.sin(this.pitchAngle)
                            const dirX = Math.sin(this.aimYaw) * cosP
                            const dirY = sinP
                            const dirZ = Math.cos(this.aimYaw) * cosP
        
                            let upVector = [0, 1, 0]
                            if (this.isWallRiding && this.currentWallNormal) {
                                upVector = [this.currentWallNormal.x * 0.5, 1, this.currentWallNormal.z * 0.5]
                            }
        
                            this.camera.lookAt([eyeX, eyeY, eyeZ], [eyeX + dirX, eyeY + dirY, eyeZ + dirZ], upVector)
                            this._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [eyeX + dirX, eyeY + dirY, eyeZ + dirZ] }
                        } else if (this.cameraMode === 'topdown') {
                            this.camera.lookAt([t.x + this.cameraShake.x, t.y + 40 + this.cameraShake.y, t.z + this.cameraShake.z], [t.x, t.y, t.z], [0, 0, -1])
                            this._cameraState = { eye: [t.x + this.cameraShake.x, t.y + 40 + this.cameraShake.y, t.z + this.cameraShake.z], target: [t.x, t.y, t.z] }
                        } else if (this.cameraMode === 'cinematic') {
                            // Slowly orbit around the target
                            const cinematicAngle = now * 0.0005
                            const dist = 25
                            const height = 15
                            const eyeX = t.x + Math.sin(cinematicAngle) * dist + this.cameraShake.x
                            const eyeY = t.y + height + this.cameraShake.y
                            const eyeZ = t.z + Math.cos(cinematicAngle) * dist + this.cameraShake.z
                            this.camera.lookAt([eyeX, eyeY, eyeZ], [t.x, t.y, t.z], [0, 1, 0])
                            this._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [t.x, t.y, t.z] }
        
                            // Depth of Field: focus on the marble for cinematic separation
                            if (this.view) {
                                const shouldUpdateDof = this._dofEnabled !== true || this._dofFocusDistance !== dist
                                if (shouldUpdateDof) {
                                    try {
                                        const graphicsQuality = this.settings?.graphics?.quality || 'medium'
                                        const dofOpts = getDofConfig('cinematic', graphicsQuality, dist)
                                        if (dofOpts) {
                                            this.view.setDepthOfFieldOptions(dofOpts)
                                            this._dofEnabled = true
                                            this._dofFocusDistance = dist
                                        }
                                    } catch (e) { /* DoF not supported, skip */ }
                                }
                            }
                        } else if (this.cameraMode === 'side-scroller') {
                            const dist = 30
                            const height = 5
                            const eyeX = t.x + dist + this.cameraShake.x
                            const eyeY = t.y + height + this.cameraShake.y
                            const eyeZ = t.z + this.cameraShake.z
                            this.camera.lookAt([eyeX, eyeY, eyeZ], [t.x, t.y, t.z], [0, 1, 0])
                            this._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [t.x, t.y, t.z] }
                        } else if (this.cameraMode === 'drone') {
                            const dist = this.droneDist || 25.0
        
                            const cosP = Math.cos(this.pitchAngle)
                            const sinP = Math.sin(this.pitchAngle)
                            const dirX = Math.sin(this.aimYaw) * cosP
                            const dirY = sinP
                            const dirZ = Math.cos(this.aimYaw) * cosP
        
                            let idealEyeX = t.x - dirX * dist
                            let idealEyeY = t.y - dirY * dist
                            let idealEyeZ = t.z - dirZ * dist
        
                            // Collision Avoidance using Rapier Raycast
                            if (this.world && typeof RAPIER !== 'undefined') {
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
        
                                const ray = new RAPIER.Ray(rayOrigin, rayDir)
        
                                const maxRayDist = Math.max(0.01, distToEye - startDist)
                                const hit = this.world.castRay(ray, maxRayDist, false)
                                if (hit) {
                                    const otherBody = hit.collider.parent()
                                    if (!otherBody || (otherBody.handle !== target.rigidBody.handle && !hit.collider.isSensor())) {
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
                            }
        
                            if (!this.cameraFollowPos) {
                                this.cameraFollowPos = { x: idealEyeX, y: idealEyeY, z: idealEyeZ }
                                this.cameraFollowLookAt = { x: t.x, y: t.y, z: t.z }
                            } else {
                                const lerpFactorPos = 0.08
                                const lerpFactorLook = 0.15
                                this.cameraFollowPos.x += (idealEyeX - this.cameraFollowPos.x) * lerpFactorPos
                                this.cameraFollowPos.y += (idealEyeY - this.cameraFollowPos.y) * lerpFactorPos
                                this.cameraFollowPos.z += (idealEyeZ - this.cameraFollowPos.z) * lerpFactorPos
        
                                this.cameraFollowLookAt.x += (t.x - this.cameraFollowLookAt.x) * lerpFactorLook
                                this.cameraFollowLookAt.y += (t.y - this.cameraFollowLookAt.y) * lerpFactorLook
                                this.cameraFollowLookAt.z += (t.z - this.cameraFollowLookAt.z) * lerpFactorLook
                            }
        
                            const eyeX = this.cameraFollowPos.x + this.cameraShake.x
                            const eyeY = this.cameraFollowPos.y + this.cameraShake.y
                            const eyeZ = this.cameraFollowPos.z + this.cameraShake.z
        
                            let upVector = [0, 1, 0]
                            if (this.isWallRiding && this.currentWallNormal) {
                                upVector = [this.currentWallNormal.x * 0.5, 1, this.currentWallNormal.z * 0.5]
                            }
        
                            this.camera.lookAt([eyeX, eyeY, eyeZ], [this.cameraFollowLookAt.x, this.cameraFollowLookAt.y, this.cameraFollowLookAt.z], upVector)
                            this._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [this.cameraFollowLookAt.x, this.cameraFollowLookAt.y, this.cameraFollowLookAt.z] }
                        }
                    }
                } else {
                    const target = this.playerMarble || this.getLeader();
                    let targetX = 0, targetY = 0, targetZ = 0;
                    let targetBodyHandle = -1;
        
                    if (target && target.rigidBody) {
                        const t = target.rigidBody.translation();
                        targetX = t.x;
                        targetY = t.y;
                        targetZ = t.z;
                        targetBodyHandle = target.rigidBody.handle;
                    }
        
                    let idealEyeX = targetX + this.camRadius * Math.sin(this.camAngle);
                    let idealEyeY = targetY + this.camHeight;
                    let idealEyeZ = targetZ + this.camRadius * Math.cos(this.camAngle);
        
                    if (this.world && typeof RAPIER !== 'undefined') {
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
                            const ray = new RAPIER.Ray(rayOrigin, rayDir);
                            const hit = this.world.castRay(ray, maxRayDist, false);
        
                            if (hit) {
                                const otherBody = hit.collider.parent();
                                if (!otherBody || (otherBody.handle !== targetBodyHandle && !hit.collider.isSensor())) {
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
                    }
        
                    const eyeX = idealEyeX + this.cameraShake.x;
                    const eyeY = idealEyeY + this.cameraShake.y;
                    const eyeZ = idealEyeZ + this.cameraShake.z;
                    this.camera.lookAt([eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 1, 0]);
                    this._cameraState = { eye: [eyeX, eyeY, eyeZ], target: [targetX, targetY, targetZ] };
                }
    }
}

export function applyGameLoopCamera(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopCamera.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopCamera.prototype[name];
        }
    }
}
