import RAPIER from '@dimforge/rapier3d-compat';
import { getDofConfig } from '../rendering/post-fx-presets.js';
import { LEVELS } from '../levels.js';

const DOF_CAMERA_MODES = new Set(['cinematic', 'follow', 'action'])
const DOF_UPDATE_THRESHOLD = 1.0

export class GameLoopCamera {
    updateCamera(now, frameDeltaSec) {
        const rotSpeed = 0.02
        const zoomSpeed = 0.5
        const FOV_CHANGE_THRESHOLD = 0.25
        const ASPECT_CHANGE_THRESHOLD = 0.001

        if (this.view && (!DOF_CAMERA_MODES.has(this.cameraMode) || !this.currentLevel) && this._dofEnabled === true) {
            try { this.view.setDepthOfFieldOptions({ enabled: false }) } catch (e) { /* not supported */ }
            this._dofEnabled = false
            this._dofFocusDistance = null
        }

        if ((this.cameraMode === 'follow' || this.cameraMode === 'action' || this.cameraMode === 'fpv' || this.cameraMode === 'topdown' || this.cameraMode === 'cinematic' || this.cameraMode === 'side-scroller' || this.cameraMode === 'drone') && this.currentLevel) {
            const level = LEVELS[this.currentLevel]
            const target = this.playerMarble || this.getLeader()
            if (target) {
                const t = target.rigidBody.translation()
                const v = target.rigidBody.linvel()
                const speed = Math.hypot(v.x, v.y, v.z)

                if (this.cameraMode === 'follow' || this.cameraMode === 'action') {
                    // Dynamic Distance Scaling
                    let targetDist = this.baseCamDist + (speed * 0.1)
                    if (this.activeEffects.speed && Date.now() < this.activeEffects.speed) {
                        targetDist *= 1.5
                    }
                    // Action camera gets lower and closer when fast
                    if (this.cameraMode === 'action') {
                        targetDist = Math.max(3.0, this.baseCamDist - (speed * 0.05))
                    }
                    this.currentCamDist += (targetDist - this.currentCamDist) * 0.05

                    // Predictive Look-Ahead
                    let lookAheadFactor = speed * 0.1
                    if (this.cameraMode === 'action') {
                        lookAheadFactor = Math.min(speed * 0.3, 15.0) // Look further ahead in action mode
                    }

                    const targetLookPos = {
                        x: t.x + (v.x * lookAheadFactor),
                        y: t.y,
                        z: t.z + (v.z * lookAheadFactor)
                    }

                    // Calculate ideal eye position
                    let idealEye = {
                        x: t.x - Math.sin(this.aimYaw) * Math.cos(this.pitchAngle) * this.currentCamDist,
                        y: t.y + Math.sin(this.pitchAngle) * this.currentCamDist + 1.0, // slight vertical offset
                        z: t.z - Math.cos(this.aimYaw) * Math.cos(this.pitchAngle) * this.currentCamDist
                    }

                    // Camera Collision Avoidance
                    if (this.world && typeof RAPIER !== 'undefined') {
                        const rayOrigin = { x: t.x, y: t.y + 0.5, z: t.z } // slightly above marble center
                        const dx = idealEye.x - rayOrigin.x
                        const dy = idealEye.y - rayOrigin.y
                        const dz = idealEye.z - rayOrigin.z
                        const distToEye = Math.hypot(dx, dy, dz)

                        if (distToEye > 0.001) {
                            const dir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye }
                            const ray = new RAPIER.Ray(rayOrigin, dir)
                            const maxDist = distToEye + 0.5

                            const hit = this.world.castRay(ray, maxDist, true)
                            if (hit) {
                                const otherBody = hit.collider.parent()
                                if (!otherBody || (otherBody.handle !== target.rigidBody.handle && !hit.collider.isSensor())) {
                                    const safeDist = hit.toi - 0.5
                                    if (safeDist > 0) {
                                        idealEye.x = rayOrigin.x + dir.x * safeDist
                                        idealEye.y = rayOrigin.y + dir.y * safeDist
                                        idealEye.z = rayOrigin.z + dir.z * safeDist
                                    }
                                }
                            }
                        }
                    }

                    // Smoothly interpolate (Lerp) towards ideal positions
                    if (!this.cameraFollowPos) {
                        this.cameraFollowPos = { ...idealEye }
                        this.cameraLookPos = { ...targetLookPos }
                    } else {
                        const lerpFactorPos = 0.1
                        const lerpFactorLook = 0.15

                        this.cameraFollowPos.x += (idealEye.x - this.cameraFollowPos.x) * lerpFactorPos
                        this.cameraFollowPos.y += (idealEye.y - this.cameraFollowPos.y) * lerpFactorPos
                        this.cameraFollowPos.z += (idealEye.z - this.cameraFollowPos.z) * lerpFactorPos

                        this.cameraLookPos.x += (targetLookPos.x - this.cameraLookPos.x) * lerpFactorLook
                        this.cameraLookPos.y += (targetLookPos.y - this.cameraLookPos.y) * lerpFactorLook
                        this.cameraLookPos.z += (targetLookPos.z - this.cameraLookPos.z) * lerpFactorLook
                    }

                    const upVector = [0, 1, 0]

                    if (this.isWallRiding && this.currentWallNormal) {
                        // Smoothly tilt the camera up-vector towards the wall normal
                        upVector[0] = this.currentWallNormal.x * 0.5
                        upVector[1] = 1.0 // Bias towards world up
                        upVector[2] = this.currentWallNormal.z * 0.5

                        // Normalize
                        const len = Math.hypot(upVector[0], upVector[1], upVector[2])
                        upVector[0] /= len
                        upVector[1] /= len
                        upVector[2] /= len
                    }

                    this.camera.lookAt(
                        [this.cameraFollowPos.x + this.cameraShake.x, this.cameraFollowPos.y + this.cameraShake.y, this.cameraFollowPos.z + this.cameraShake.z],
                        [this.cameraLookPos.x, this.cameraLookPos.y, this.cameraLookPos.z],
                        upVector
                    )

                    // Dynamic FOV scaling based on speed
                    if (this.view && this.camera && this.Filament) {
                        const baseFov = this.cameraMode === 'action' ? 70 : 60
                        const maxFov = this.cameraMode === 'action' ? 100 : 85
                        const fovIncrease = Math.min(speed * 0.8, maxFov - baseFov)
                        const targetFov = baseFov + fovIncrease

                        this.currentFov += (targetFov - this.currentFov) * 0.1

                        const aspect = window.innerWidth / window.innerHeight
                        const fovChanged = Math.abs(this.currentFov - this.lastFov) > FOV_CHANGE_THRESHOLD
                        const aspectChanged = Math.abs(aspect - this.lastAspect) > ASPECT_CHANGE_THRESHOLD

                        if (fovChanged || aspectChanged) {
                            this.camera.setProjectionFov(
                                this.currentFov,
                                aspect,
                                0.1,
                                1000.0,
                                this.Filament.Camera$Fov.VERTICAL
                            )
                            this.lastFov = this.currentFov
                            this.lastAspect = aspect
                        }
                    }

                    // DoF for follow/action modes — subtle focus on the marble; only on high/ultra
                    if (this.view) {
                        const gfxLvl = this.getGraphicsLevel()
                        const dofOpts = getDofConfig(gfxLvl, this.cameraMode)

                        if (dofOpts) {
                            const dx = this.cameraFollowPos.x - t.x
                            const dy = this.cameraFollowPos.y - t.y
                            const dz = this.cameraFollowPos.z - t.z
                            const newFocusDist = Math.hypot(dx, dy, dz)

                            const shouldUpdateDof = !this._dofEnabled ||
                                                    this._dofFocusDistance === null ||
                                                    Math.abs(newFocusDist - this._dofFocusDistance) > DOF_UPDATE_THRESHOLD

                            if (shouldUpdateDof) {
                                try {
                                    this.view.setDepthOfFieldOptions({
                                        enabled: true,
                                        focusDistance: newFocusDist,
                                        ...dofOpts
                                    })
                                    this._dofEnabled = true
                                    this._dofFocusDistance = newFocusDist
                                } catch (e) {
                                    /* not supported */
                                }
                            }
                        } else if (this._dofEnabled) {
                            try { this.view.setDepthOfFieldOptions({ enabled: false }) } catch (e) { /* not supported */ }
                            this._dofEnabled = false
                            this._dofFocusDistance = null
                        }
                    }

                } else if (this.cameraMode === 'fpv') {
                    const upVector = [0, 1, 0]

                    if (this.isWallRiding && this.currentWallNormal) {
                        upVector[0] = this.currentWallNormal.x * 0.5
                        upVector[1] = 1.0
                        upVector[2] = this.currentWallNormal.z * 0.5

                        const len = Math.hypot(upVector[0], upVector[1], upVector[2])
                        upVector[0] /= len
                        upVector[1] /= len
                        upVector[2] /= len
                    }

                    const eye = [t.x, t.y + 0.25, t.z]
                    const lookAtPos = [
                        t.x + Math.sin(this.aimYaw) * Math.cos(this.pitchAngle),
                        t.y + 0.25 + Math.sin(this.pitchAngle),
                        t.z + Math.cos(this.aimYaw) * Math.cos(this.pitchAngle)
                    ]
                    this.camera.lookAt(eye, lookAtPos, upVector)

                    if (this.view) {
                        const shouldUpdateDof = !this._dofEnabled || this._dofFocusDistance !== 5.0
                        if (shouldUpdateDof) {
                            const gfxLvl = this.getGraphicsLevel()
                            if (gfxLvl === 'ultra' || gfxLvl === 'high') {
                                const dofOpts = getDofConfig(gfxLvl, 'fpv')
                                if (dofOpts) {
                                    try {
                                        this.view.setDepthOfFieldOptions({
                                            enabled: true,
                                            focusDistance: 5.0, // Fixed focus slightly ahead
                                            ...dofOpts
                                        })
                                        this._dofEnabled = true
                                        this._dofFocusDistance = 5.0
                                    } catch(e) {}
                                }
                            }
                        }
                    }
                } else if (this.cameraMode === 'topdown') {
                    this.camera.lookAt(
                        [t.x, t.y + 30, t.z],
                        [t.x, t.y, t.z],
                        [0, 0, -1]
                    )
                } else if (this.cameraMode === 'cinematic') {
                    const now = Date.now() / 1000
                    const radius = 15
                    const height = 10
                    const cx = t.x + Math.cos(now * 0.5) * radius
                    const cz = t.z + Math.sin(now * 0.5) * radius

                    this.camera.lookAt(
                        [cx, t.y + height, cz],
                        [t.x, t.y, t.z],
                        [0, 1, 0]
                    )

                    if (this.view) {
                        const dx = cx - t.x
                        const dy = height
                        const dz = cz - t.z
                        const focusDist = Math.hypot(dx, dy, dz)

                        const shouldUpdateDof = !this._dofEnabled ||
                                                this._dofFocusDistance === null ||
                                                Math.abs(focusDist - this._dofFocusDistance) > DOF_UPDATE_THRESHOLD

                        if (shouldUpdateDof) {
                            const gfxLvl = this.getGraphicsLevel()
                            const dofOpts = getDofConfig(gfxLvl, 'cinematic')
                            if (dofOpts) {
                                try {
                                    this.view.setDepthOfFieldOptions({
                                        enabled: true,
                                        focusDistance: focusDist,
                                        ...dofOpts
                                    })
                                    this._dofEnabled = true
                                    this._dofFocusDistance = focusDist
                                } catch(e) {}
                            }
                        }
                    }
                } else if (this.cameraMode === 'side-scroller') {
                    this.camera.lookAt(
                        [t.x + 20, t.y + 5, t.z], // Offset along X
                        [t.x, t.y, t.z],          // Look at marble
                        [0, 1, 0]
                    )
                } else if (this.cameraMode === 'drone') {
                    const targetLookPos = { x: t.x, y: t.y, z: t.z }
                    let idealEye = {
                        x: t.x - Math.sin(this.aimYaw) * Math.cos(this.pitchAngle) * this.droneDist,
                        y: t.y + Math.sin(this.pitchAngle) * this.droneDist,
                        z: t.z - Math.cos(this.aimYaw) * Math.cos(this.pitchAngle) * this.droneDist
                    }

                    if (this.world && typeof RAPIER !== 'undefined') {
                        const rayOrigin = { x: t.x, y: t.y, z: t.z }
                        const dx = idealEye.x - rayOrigin.x
                        const dy = idealEye.y - rayOrigin.y
                        const dz = idealEye.z - rayOrigin.z
                        const distToEye = Math.hypot(dx, dy, dz)

                        if (distToEye > 0.001) {
                            const dir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye }
                            const ray = new RAPIER.Ray(rayOrigin, dir)

                            const hit = this.world.castRay(ray, distToEye, true)
                            if (hit) {
                                const otherBody = hit.collider.parent()
                                if (!otherBody || (otherBody.handle !== target.rigidBody.handle && !hit.collider.isSensor())) {
                                    const safeDist = hit.toi - 0.5
                                    if (safeDist > 0) {
                                        idealEye.x = rayOrigin.x + dir.x * safeDist
                                        idealEye.y = rayOrigin.y + dir.y * safeDist
                                        idealEye.z = rayOrigin.z + dir.z * safeDist
                                    }
                                }
                            }
                        }
                    }

                    if (!this.cameraFollowPos) {
                        this.cameraFollowPos = { ...idealEye }
                        this.cameraLookPos = { ...targetLookPos }
                    } else {
                        const lerpFactor = 0.05
                        this.cameraFollowPos.x += (idealEye.x - this.cameraFollowPos.x) * lerpFactor
                        this.cameraFollowPos.y += (idealEye.y - this.cameraFollowPos.y) * lerpFactor
                        this.cameraFollowPos.z += (idealEye.z - this.cameraFollowPos.z) * lerpFactor

                        this.cameraLookPos.x += (targetLookPos.x - this.cameraLookPos.x) * lerpFactor
                        this.cameraLookPos.y += (targetLookPos.y - this.cameraLookPos.y) * lerpFactor
                        this.cameraLookPos.z += (targetLookPos.z - this.cameraLookPos.z) * lerpFactor
                    }

                    const upVector = [0, 1, 0]
                    if (this.isWallRiding && this.currentWallNormal) {
                        upVector[0] = this.currentWallNormal.x * 0.5
                        upVector[1] = 1.0
                        upVector[2] = this.currentWallNormal.z * 0.5
                        const len = Math.hypot(upVector[0], upVector[1], upVector[2])
                        upVector[0] /= len
                        upVector[1] /= len
                        upVector[2] /= len
                    }

                    this.camera.lookAt(
                        [this.cameraFollowPos.x + this.cameraShake.x, this.cameraFollowPos.y + this.cameraShake.y, this.cameraFollowPos.z + this.cameraShake.z],
                        [this.cameraLookPos.x, this.cameraLookPos.y, this.cameraLookPos.z],
                        upVector
                    )
                }
            }
        } else if (this.isLockedOn && this.lockOnTarget) {
            const target = this.lockOnTarget;
            if (target && target.rigidBody && this.playerMarble) {
                const t = target.rigidBody.translation();
                const pt = this.playerMarble.rigidBody.translation();

                // Calculate direction from player to target
                const dxTarget = t.x - pt.x;
                const dzTarget = t.z - pt.z;

                // Update aimYaw to gradually face target
                const targetYaw = Math.atan2(dxTarget, dzTarget);

                // Smoothly rotate camera towards target
                let yawDiff = targetYaw - this.aimYaw;
                while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
                while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
                this.aimYaw += yawDiff * 0.1;

                let idealEye = {
                    x: pt.x - Math.sin(this.aimYaw) * Math.cos(this.pitchAngle) * this.currentCamDist,
                    y: pt.y + Math.sin(this.pitchAngle) * this.currentCamDist + 1.0,
                    z: pt.z - Math.cos(this.aimYaw) * Math.cos(this.pitchAngle) * this.currentCamDist
                };

                // Camera Collision Avoidance (same logic as follow mode)
                if (this.world && typeof RAPIER !== 'undefined') {
                    const rayOrigin = { x: pt.x, y: pt.y + 0.5, z: pt.z };
                    const dx = idealEye.x - rayOrigin.x;
                    const dy = idealEye.y - rayOrigin.y;
                    const dz = idealEye.z - rayOrigin.z;
                    const distToEye = Math.hypot(dx, dy, dz);

                    if (distToEye > 0.001) {
                        const dir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye };
                        const ray = new RAPIER.Ray(rayOrigin, dir);
                        const maxDist = distToEye + 0.5;
                        const targetBodyHandle = target.rigidBody.handle;

                        const hit = this.world.castRay(ray, maxDist, true);
                        if (hit) {
                            const otherBody = hit.collider.parent();
                            if (!otherBody || (otherBody.handle !== targetBodyHandle && !hit.collider.isSensor())) {
                                const safeDist = hit.toi - 0.5;
                                if (safeDist > 0) {
                                    idealEye.x = rayOrigin.x + dir.x * safeDist;
                                    idealEye.y = rayOrigin.y + dir.y * safeDist;
                                    idealEye.z = rayOrigin.z + dir.z * safeDist;
                                }
                            }
                        }
                    }
                }

                if (!this.cameraFollowPos) {
                    this.cameraFollowPos = { ...idealEye };
                    this.cameraLookPos = { x: t.x, y: t.y, z: t.z };
                } else {
                    this.cameraFollowPos.x += (idealEye.x - this.cameraFollowPos.x) * 0.1;
                    this.cameraFollowPos.y += (idealEye.y - this.cameraFollowPos.y) * 0.1;
                    this.cameraFollowPos.z += (idealEye.z - this.cameraFollowPos.z) * 0.1;

                    // Interpolate lock-on look pos between player and target
                    const lookX = pt.x + (t.x - pt.x) * 0.5;
                    const lookY = pt.y + (t.y - pt.y) * 0.5 + 1.0;
                    const lookZ = pt.z + (t.z - pt.z) * 0.5;

                    this.cameraLookPos.x += (lookX - this.cameraLookPos.x) * 0.15;
                    this.cameraLookPos.y += (lookY - this.cameraLookPos.y) * 0.15;
                    this.cameraLookPos.z += (lookZ - this.cameraLookPos.z) * 0.15;
                }

                this.camera.lookAt(
                    [this.cameraFollowPos.x, this.cameraFollowPos.y, this.cameraFollowPos.z],
                    [this.cameraLookPos.x, this.cameraLookPos.y, this.cameraLookPos.z],
                    [0, 1, 0]
                );
            }
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
